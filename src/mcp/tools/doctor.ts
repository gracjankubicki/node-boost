import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { buildInstallOperations } from "../../install/orchestrator.js";
import { resolveDefaultPackageRoot } from "../../install/project.js";
import { detectStack } from "../../detect/stack.js";
import { readBoostConfig } from "../project.js";
import { generatedManifestPath, inspectGeneratedOwnership } from "../../install/generated-manifest.js";
import { readTypeScriptConfig } from "../../config/typescript-config.js";
import { loadNodeBoostPlugins } from "../../plugin/runtime.js";
import type { NodeBoostConfig } from "../../config/schema.js";

export type DoctorCheckId =
  | "config-present"
  | "config-valid"
  | "plugins-valid"
  | "generated-with-drift"
  | "stack-detected"
  | "resources-fresh"
  | "agent-files-present"
  | "overrides-detected"
  | "hooks-wired"
  | "lint-strict";

export interface DoctorCheck {
  id: DoctorCheckId;
  status: "pass" | "warn" | "fail" | "skip";
  message: string;
  details?: string[];
}

export interface DoctorResult {
  ok: boolean;
  checks: DoctorCheck[];
}

export async function doctorTool(rootDir: string, boostVersion: string): Promise<DoctorResult> {
  const checks: DoctorCheck[] = [];
  const configRaw = await readOptional(join(rootDir, "node-boost.json"));
  const boostConfig = await readBoostConfig(rootDir);
  const stack = await detectStack(rootDir);

  checks.push({
    id: "config-present",
    status: configRaw === null ? "fail" : "pass",
    message: configRaw === null ? "node-boost.json is missing. Run node-boost install." : "node-boost.json is present.",
  });

  checks.push({
    id: "config-valid",
    status: boostConfig.config ? "pass" : "fail",
    message: boostConfig.config ? "node-boost.json is valid." : `node-boost.json is invalid: ${boostConfig.error?.message ?? "unknown error"}`,
  });

  checks.push({
    id: "generated-with-drift",
    status: !boostConfig.config || boostConfig.config.generatedWith === boostVersion ? "pass" : "fail",
    message: !boostConfig.config
      ? "No generatedWith drift can be checked without a valid config."
      : boostConfig.config.generatedWith === boostVersion
        ? "generatedWith matches the installed package version."
        : `generatedWith is ${boostConfig.config.generatedWith}, package is ${boostVersion}. Run node-boost update.`,
  });

  checks.push({
    id: "stack-detected",
    status: stack.name === "unknown" ? "fail" : "pass",
    message: stack.name === "unknown" ? "No supported React stack detected." : `Detected ${stack.name}.`,
  });

  if (!boostConfig.config) {
    checks.push(skipCheck("plugins-valid", "Requires a valid node-boost.json."));
    checks.push(skipCheck("resources-fresh", "Requires a valid node-boost.json."));
    checks.push(skipCheck("agent-files-present", "Requires a valid node-boost.json."));
    checks.push(await overridesCheck(rootDir));
    checks.push(skipCheck("hooks-wired", "Requires a valid node-boost.json."));
    checks.push(lintStrictCheck(rootDir));
    return withOk(checks);
  }

  const plugins = await pluginsValidCheck(rootDir, boostConfig.config);
  checks.push(plugins);
  if (plugins.status === "fail") {
    checks.push(skipCheck("resources-fresh", "Requires valid configured plugins."));
    checks.push(skipCheck("agent-files-present", "Requires valid configured plugins."));
    checks.push(await overridesCheck(rootDir));
    checks.push(skipCheck("hooks-wired", "Requires valid configured plugins."));
    checks.push(lintStrictCheck(rootDir));
    return withOk(checks);
  }

  const packageRoot = await resolveDefaultPackageRoot(import.meta.url);
  const expectedOperations = await buildInstallOperations({
    packageRoot,
    projectRoot: rootDir,
    stack,
    config: boostConfig.config,
  });

  checks.push(await resourcesFreshCheck(rootDir, expectedOperations));
  checks.push(await agentFilesPresentCheck(rootDir, expectedOperations));
  checks.push(await overridesCheck(rootDir));
  checks.push(await hooksWiredCheck(rootDir, boostConfig.config.features.hooks, expectedOperations));
  checks.push(lintStrictCheck(rootDir));

  return withOk(checks);
}

async function pluginsValidCheck(rootDir: string, config: NodeBoostConfig): Promise<DoctorCheck> {
  try {
    const plugins = await loadNodeBoostPlugins(rootDir, config.plugins ?? []);
    return {
      id: "plugins-valid",
      status: "pass",
      message: plugins.length === 0
        ? "No content plugins configured."
        : `${plugins.length} content plugin(s) loaded: ${plugins.map((plugin) => plugin.packageName).join(", ")}.`,
      details: plugins.map((plugin) => `${plugin.packageName}: dependency`),
    };
  } catch (error) {
    return {
      id: "plugins-valid",
      status: "fail",
      message: error instanceof Error ? error.message : "Configured plugin validation failed.",
    };
  }
}

async function resourcesFreshCheck(rootDir: string, expectedOperations: Array<{ path: string; content: string }>): Promise<DoctorCheck> {
  const inspection = await inspectGeneratedOwnership(rootDir, expectedOperations);
  const details = [
    ...inspection.stale.map((path) => `stale: ${path}`),
    ...inspection.modified.map((path) => `modified: ${path}`),
    ...inspection.outdated.map((path) => `outdated: ${path}`),
  ];

  return {
    id: "resources-fresh",
    status: details.length === 0 ? "pass" : "fail",
    message: details.length === 0
      ? "Generated resources match current node-boost output."
      : `${details.length} generated resource issue(s) found. Run node-boost update and review conflicts.`,
    details,
  };
}

async function agentFilesPresentCheck(rootDir: string, expectedOperations: Array<{ path: string; content: string }>): Promise<DoctorCheck> {
  const expected = expectedOperations
    .filter((operation) => !operation.path.startsWith(".ai/") && operation.path !== "node-boost.json");
  const stale = await changedExpectedFiles(rootDir, expected);

  return {
    id: "agent-files-present",
    status: stale.length === 0 ? "pass" : "fail",
    message: stale.length === 0
      ? "Configured agent integrations match the desired state."
      : `${stale.length} agent integration file(s) missing or stale. Run node-boost update.`,
    details: stale,
  };
}

async function hooksWiredCheck(rootDir: string, hooksEnabled: boolean, expectedOperations: Array<{ path: string; content: string }>): Promise<DoctorCheck> {
  const hookOperations = expectedOperations.filter((operation) =>
    operation.path === ".claude/settings.json" || operation.path === ".codex/hooks.json" || operation.path === ".cursor/hooks.json",
  );
  const stale = await changedExpectedFiles(rootDir, hookOperations);

  return {
    id: "hooks-wired",
    status: stale.length === 0 ? "pass" : "fail",
    message: stale.length === 0
      ? hooksEnabled ? "Configured hook entries are wired." : "Hooks feature is disabled and no stale node-boost hook remains."
      : `${stale.length} hook config file(s) missing or stale. Run node-boost update.`,
    details: stale,
  };
}

async function overridesCheck(rootDir: string): Promise<DoctorCheck> {
  const overridesRoot = join(rootDir, ".node-boost");
  const overrides = (await listFiles(overridesRoot)).filter((file) =>
    relative(rootDir, file).replaceAll("\\", "/") !== generatedManifestPath,
  );

  return {
    id: "overrides-detected",
    status: "pass",
    message: overrides.length === 0 ? "No .node-boost overrides detected." : `${overrides.length} .node-boost override(s) active.`,
    details: overrides.map((file) => relative(overridesRoot, file).replaceAll("\\", "/")),
  };
}

function lintStrictCheck(rootDir: string): DoctorCheck {
  const strict = readTypeScriptConfig(rootDir).strict;

  return {
    id: "lint-strict",
    status: strict === true ? "pass" : "warn",
    message: strict === true ? "TypeScript strict mode is enabled." : "TypeScript strict mode is not enabled. Enable compilerOptions.strict.",
  };
}

async function changedExpectedFiles(rootDir: string, expectedOperations: Array<{ path: string; content: string }>): Promise<string[]> {
  const changed = await Promise.all(
    expectedOperations.map(async (operation) => {
      const current = await readOptional(join(rootDir, operation.path));
      return current === operation.content ? null : operation.path;
    }),
  );

  return changed.filter((path): path is string => path !== null).sort((a, b) => a.localeCompare(b));
}

async function listFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const nested = await Promise.all(
      entries.map(async (entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          return listFiles(path);
        }

        return entry.isFile() ? [path] : [];
      }),
    );
    return nested.flat().sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

async function readOptional(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

function skipCheck(id: DoctorCheckId, message: string): DoctorCheck {
  return { id, status: "skip", message };
}

function withOk(checks: DoctorCheck[]): DoctorResult {
  return {
    ok: checks.every((check) => check.status !== "fail"),
    checks,
  };
}

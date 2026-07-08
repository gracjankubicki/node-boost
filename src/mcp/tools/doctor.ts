import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { buildInstallOperations } from "../../install/orchestrator.js";
import { resolveDefaultPackageRoot } from "../../install/project.js";
import { detectStack } from "../../detect/stack.js";
import { readBoostConfig } from "../project.js";

export type DoctorCheckId =
  | "config-present"
  | "config-valid"
  | "generated-with-drift"
  | "stack-detected"
  | "resources-fresh"
  | "agent-files-present"
  | "overrides-detected"
  | "hooks-wired"
  | "lint-strict";

export interface DoctorCheck {
  id: DoctorCheckId;
  status: "pass" | "warn" | "fail";
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
    status: !boostConfig.config || boostConfig.config.generatedWith === boostVersion ? "pass" : "warn",
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
    checks.push(skipCheck("resources-fresh", "Requires a valid node-boost.json."));
    checks.push(skipCheck("agent-files-present", "Requires a valid node-boost.json."));
    checks.push(await overridesCheck(rootDir));
    checks.push(skipCheck("hooks-wired", "Requires a valid node-boost.json."));
    checks.push(await lintStrictCheck(rootDir));
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
  checks.push(await lintStrictCheck(rootDir));

  return withOk(checks);
}

async function resourcesFreshCheck(rootDir: string, expectedOperations: Array<{ path: string; content: string }>): Promise<DoctorCheck> {
  const stale = await changedExpectedFiles(rootDir, expectedOperations.filter((operation) => operation.path.startsWith(".ai/")));

  return {
    id: "resources-fresh",
    status: stale.length === 0 ? "pass" : "warn",
    message: stale.length === 0 ? "Generated .ai resources match current node-boost output." : `${stale.length} generated .ai resource(s) differ. Run node-boost update.`,
    details: stale,
  };
}

async function agentFilesPresentCheck(rootDir: string, expectedOperations: Array<{ path: string }>): Promise<DoctorCheck> {
  const expected = expectedOperations
    .filter((operation) => !operation.path.startsWith(".ai/") && operation.path !== "node-boost.json")
    .map((operation) => operation.path);
  const missing = await missingFiles(rootDir, expected);

  return {
    id: "agent-files-present",
    status: missing.length === 0 ? "pass" : "fail",
    message: missing.length === 0 ? "Configured agent files are present." : `${missing.length} configured agent file(s) missing. Run node-boost update.`,
    details: missing,
  };
}

async function hooksWiredCheck(rootDir: string, hooksEnabled: boolean, expectedOperations: Array<{ path: string; content: string }>): Promise<DoctorCheck> {
  if (!hooksEnabled) {
    return {
      id: "hooks-wired",
      status: "pass",
      message: "Hooks feature is disabled.",
    };
  }

  const hookOperations = expectedOperations.filter((operation) =>
    operation.path === ".claude/settings.json" || operation.path === ".codex/hooks.json" || operation.path === ".cursor/hooks.json",
  );
  const stale = await changedExpectedFiles(rootDir, hookOperations);

  return {
    id: "hooks-wired",
    status: stale.length === 0 ? "pass" : "fail",
    message: stale.length === 0 ? "Configured hook entries are wired." : `${stale.length} hook config file(s) missing or stale. Run node-boost update.`,
    details: stale,
  };
}

async function overridesCheck(rootDir: string): Promise<DoctorCheck> {
  const overrides = await listFiles(join(rootDir, ".node-boost"));

  return {
    id: "overrides-detected",
    status: "pass",
    message: overrides.length === 0 ? "No .node-boost overrides detected." : `${overrides.length} .node-boost override(s) active.`,
    details: overrides.map((file) => relative(join(rootDir, ".node-boost"), file).replaceAll("\\", "/")),
  };
}

async function lintStrictCheck(rootDir: string): Promise<DoctorCheck> {
  const strict = await tsconfigStrict(rootDir);

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

async function missingFiles(rootDir: string, paths: string[]): Promise<string[]> {
  const missing = await Promise.all(paths.map(async (path) => ((await readOptional(join(rootDir, path))) === null ? path : null)));
  return missing.filter((path): path is string => path !== null).sort((a, b) => a.localeCompare(b));
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

async function tsconfigStrict(rootDir: string): Promise<boolean | null> {
  const visited = new Set<string>();
  return readStrictFromTsconfig(join(rootDir, "tsconfig.json"), visited);
}

async function readStrictFromTsconfig(path: string, visited: Set<string>): Promise<boolean | null> {
  if (visited.has(path)) {
    return null;
  }

  visited.add(path);
  const raw = await readOptional(path);
  if (!raw) {
    return null;
  }

  const parsed = JSON.parse(stripJsonComments(raw)) as { extends?: string; compilerOptions?: { strict?: boolean } };
  if (typeof parsed.compilerOptions?.strict === "boolean") {
    return parsed.compilerOptions.strict;
  }

  if (parsed.extends?.startsWith(".")) {
    return readStrictFromTsconfig(join(path, "..", parsed.extends), visited);
  }

  return null;
}

async function readOptional(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

function stripJsonComments(value: string): string {
  return value.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function skipCheck(id: DoctorCheckId, message: string): DoctorCheck {
  return { id, status: "warn", message };
}

function withOk(checks: DoctorCheck[]): DoctorResult {
  return {
    ok: checks.every((check) => check.status !== "fail"),
    checks,
  };
}

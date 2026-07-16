import { mkdtemp, readdir, readFile, rm, writeFile, cp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildInstallOperations, runInstall, runUpdate } from "../../src/install/orchestrator.js";
import { detectStack } from "../../src/detect/stack.js";
import { createPackageCommand } from "../../src/agents/agent.js";
import { doctorTool } from "../../src/mcp/tools/doctor.js";
import { runAudit } from "../../src/audit/engine.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("install orchestrator", () => {
  it.each([
    ["npm", { command: "npm", args: ["exec", "--", "node-boost", "guard", "--hook", "codex"] }],
    ["pnpm", { command: "pnpm", args: ["exec", "node-boost", "guard", "--hook", "codex"] }],
    ["yarn", { command: "yarn", args: ["node-boost", "guard", "--hook", "codex"] }],
    ["bun", { command: "bunx", args: ["node-boost", "guard", "--hook", "codex"] }],
  ] as const)("creates an exact %s package command", (packageManager, expected) => {
    expect(createPackageCommand(packageManager, ["guard", "--hook", "codex"])).toEqual(expected);
  });

  it.each(["next-app", "vite-app"])("installs all agents for %s and is idempotent", async (fixtureName) => {
    await withFixture(fixtureName, async (projectRoot) => {
      const first = await runInstall({ cwd: projectRoot, packageRoot: repoRoot, noInteraction: true });
      const afterFirst = await snapshotTree(projectRoot);
      const second = await runInstall({ cwd: projectRoot, packageRoot: repoRoot, noInteraction: true });
      const afterSecond = await snapshotTree(projectRoot);

      expect(first.operations.some((operation) => operation.status === "created")).toBe(true);
      expect(second.operations.every((operation) => operation.status === "skipped")).toBe(true);
      expect(afterSecond).toEqual(afterFirst);

      await expectPath(projectRoot, ".ai/guidelines/node-boost.md");
      await expectPath(projectRoot, ".ai/skills/react-development/SKILL.md");
      await expectPath(projectRoot, ".agents/skills/react-development/SKILL.md");
      await expectPath(projectRoot, ".claude/skills/react-development/SKILL.md");
      await expectPath(projectRoot, "CLAUDE.md");
      await expectPath(projectRoot, "AGENTS.md");
      await expectPath(projectRoot, ".mcp.json");
      await expectPath(projectRoot, ".codex/config.toml");
      await expectPath(projectRoot, ".cursor/rules/node-boost.mdc");
      await expectPath(projectRoot, ".cursor/mcp.json");
      await expectPath(projectRoot, "node-boost.json");
    });
  });

  it("installs Vite guidance without the routing skill when React Router is absent", async () => {
    await withFixture("vite-no-router", async (projectRoot) => {
      const result = await runInstall({ cwd: projectRoot, packageRoot: repoRoot, noInteraction: true });
      const paths = result.operations.map((operation) => operation.path);

      expect(result.stack).toMatchObject({ name: "vite-react", router: "none" });
      expect(paths).toContain(".ai/guidelines/vite/core.md");
      expect(paths).toContain(".ai/skills/react-development/SKILL.md");
      expect(paths).not.toContain(".ai/skills/spa-routing/SKILL.md");

      await writeFile(join(projectRoot, "src/runtime.ts"), "export const api = process.env.API_URL;\n", "utf8");
      const audit = await runAudit({ rootDir: projectRoot, mode: "all" });
      expect(audit.findings).toContainEqual(expect.objectContaining({ rule: "NB-ARCH-008", file: "src/runtime.ts" }));
    });
  });

  it("reports missing package.json and invalid update config", async () => {
    await withTempDir(async (emptyDir) => {
      await expect(runInstall({ cwd: emptyDir, packageRoot: repoRoot, noInteraction: true })).rejects.toThrow(
        "No package.json found",
      );
    });

    await withFixture("next-app", async (projectRoot) => {
      await writeFile(join(projectRoot, "node-boost.json"), JSON.stringify({ version: 2, stack: "next" }), "utf8");

      await expect(runUpdate({ cwd: projectRoot, packageRoot: repoRoot })).rejects.toThrow("Invalid node-boost.json");
    });
  });

  it("writes a resolvable local schema and refreshes generatedWith on update", async () => {
    await withFixture("next-app", async (projectRoot) => {
      await runInstall({ cwd: projectRoot, packageRoot: repoRoot, noInteraction: true });
      const installed = JSON.parse(await readFile(join(projectRoot, "node-boost.json"), "utf8")) as {
        $schema: string;
        generatedWith: string;
      };

      expect(installed.$schema).toBe("./.ai/node-boost.schema.json");
      await expect(readFile(join(projectRoot, installed.$schema), "utf8")).resolves.toContain("node-boost configuration");

      const upgradedPackageRoot = join(projectRoot, ".test-node-boost-package");
      await mkdir(upgradedPackageRoot, { recursive: true });
      await cp(join(repoRoot, "resources"), join(upgradedPackageRoot, "resources"), { recursive: true });
      await cp(join(repoRoot, "schema.json"), join(upgradedPackageRoot, "schema.json"));
      await writeFile(join(upgradedPackageRoot, "package.json"), JSON.stringify({ version: "0.1.1" }), "utf8");

      const first = await runUpdate({ cwd: projectRoot, packageRoot: upgradedPackageRoot });
      expect(first.config.generatedWith).toBe("0.1.1");
      const updated = JSON.parse(await readFile(join(projectRoot, "node-boost.json"), "utf8")) as { generatedWith: string };
      expect(updated.generatedWith).toBe("0.1.1");

      const second = await runUpdate({ cwd: projectRoot, packageRoot: upgradedPackageRoot });
      expect(second.operations.every((operation) => operation.status === "skipped")).toBe(true);
    });
  });

  it("does not parse broken integration files for disabled features", async () => {
    await withFixture("next-app", async (projectRoot) => {
      await runInstall({ cwd: projectRoot, packageRoot: repoRoot, noInteraction: true });
      await updateConfig(projectRoot, (config) => {
        config.features.mcp = false;
        config.features.hooks = false;
        config.hookAgents = [];
      });
      await writeFile(join(projectRoot, ".mcp.json"), "{ invalid", "utf8");
      await writeFile(join(projectRoot, ".codex/config.toml"), "[invalid", "utf8");
      await writeFile(join(projectRoot, ".cursor/mcp.json"), "{ invalid", "utf8");
      await writeFile(join(projectRoot, ".claude/settings.json"), "{ invalid", "utf8");
      await writeFile(join(projectRoot, ".codex/hooks.json"), "{ invalid", "utf8");
      await writeFile(join(projectRoot, ".cursor/hooks.json"), "{ invalid", "utf8");

      await expect(runUpdate({ cwd: projectRoot, packageRoot: repoRoot })).resolves.toBeDefined();
    });
  });

  it("removes stale owned resources and converges on the second update", async () => {
    await withFixture("next-app", async (projectRoot) => {
      await runInstall({ cwd: projectRoot, packageRoot: repoRoot, noInteraction: true });
      await removeArchitecture(projectRoot, "feature-modules");

      const beforeUpdate = await doctorTool(projectRoot, "0.1.0");
      expect(beforeUpdate.checks).toContainEqual(expect.objectContaining({ id: "resources-fresh", status: "fail" }));

      const first = await runUpdate({ cwd: projectRoot, packageRoot: repoRoot });
      expect(first.operations).toContainEqual(expect.objectContaining({
        path: ".ai/guidelines/architectures/feature-modules.md",
        status: "deleted",
      }));
      await expect(readFile(join(projectRoot, ".ai/guidelines/architectures/feature-modules.md"), "utf8")).rejects.toThrow();
      await expect(readFile(join(projectRoot, ".ai/skills/feature-modules/SKILL.md"), "utf8")).rejects.toThrow();
      await expect(readFile(join(projectRoot, ".agents/skills/feature-modules/SKILL.md"), "utf8")).rejects.toThrow();
      await expect(readFile(join(projectRoot, ".claude/skills/feature-modules/SKILL.md"), "utf8")).rejects.toThrow();

      const second = await runUpdate({ cwd: projectRoot, packageRoot: repoRoot });
      expect(second.operations.every((operation) => operation.status === "skipped")).toBe(true);
    });
  });

  it("preserves modified owned and never-owned files with a conflict", async () => {
    await withFixture("next-app", async (projectRoot) => {
      await runInstall({ cwd: projectRoot, packageRoot: repoRoot, noInteraction: true });
      const modifiedPath = ".ai/guidelines/architectures/feature-modules.md";
      const customPath = ".ai/guidelines/my-team.md";
      await writeFile(join(projectRoot, modifiedPath), "# My edited guidance\n", "utf8");
      await writeFile(join(projectRoot, customPath), "# Never owned\n", "utf8");
      await removeArchitecture(projectRoot, "feature-modules");

      const result = await runUpdate({ cwd: projectRoot, packageRoot: repoRoot });

      expect(result.operations).toContainEqual(expect.objectContaining({ path: modifiedPath, status: "conflict" }));
      await expect(readFile(join(projectRoot, modifiedPath), "utf8")).resolves.toBe("# My edited guidance\n");
      await expect(readFile(join(projectRoot, customPath), "utf8")).resolves.toBe("# Never owned\n");

      const doctor = await doctorTool(projectRoot, "0.1.0");
      const freshness = doctor.checks.find((check) => check.id === "resources-fresh");
      expect(freshness).toMatchObject({ status: "fail" });
      expect(freshness?.details).toContain(`modified: ${modifiedPath}`);
    });
  });

  it("migrates without a manifest conservatively", async () => {
    await withFixture("next-app", async (projectRoot) => {
      await runInstall({ cwd: projectRoot, packageRoot: repoRoot, noInteraction: true });
      const stalePath = ".ai/guidelines/architectures/feature-modules.md";
      await rm(join(projectRoot, ".node-boost/generated-manifest.json"));
      await removeArchitecture(projectRoot, "feature-modules");

      const result = await runUpdate({ cwd: projectRoot, packageRoot: repoRoot });

      expect(result.operations).not.toContainEqual(expect.objectContaining({ path: stalePath, status: "deleted" }));
      await expect(readFile(join(projectRoot, stalePath), "utf8")).resolves.toBeTypeOf("string");
      const manifest = JSON.parse(await readFile(join(projectRoot, ".node-boost/generated-manifest.json"), "utf8")) as {
        version: number;
        files: Array<{ path: string; sha256: string }>;
      };
      expect(manifest.version).toBe(1);
      expect(manifest.files.some((file) => file.path === stalePath)).toBe(false);
    });
  });

  it("unmerges disabled agents, MCP servers, and hooks while preserving foreign content", async () => {
    await withFixture("next-app", async (projectRoot) => {
      await Promise.all([
        mkdir(join(projectRoot, ".claude"), { recursive: true }),
        mkdir(join(projectRoot, ".codex"), { recursive: true }),
        mkdir(join(projectRoot, ".cursor"), { recursive: true }),
      ]);
      await writeFile(join(projectRoot, "CLAUDE.md"), "before claude\n\nafter claude\n", "utf8");
      await writeFile(join(projectRoot, "AGENTS.md"), "before agents\n\nafter agents\n", "utf8");
      await writeFile(join(projectRoot, ".mcp.json"), JSON.stringify({ mcpServers: { other: { command: "other" } } }), "utf8");
      await writeFile(join(projectRoot, ".codex/config.toml"), '[mcp_servers.other]\ncommand = "other"\n', "utf8");
      await writeFile(join(projectRoot, ".cursor/mcp.json"), JSON.stringify({ mcpServers: { other: { command: "other" } } }), "utf8");

      await runInstall({ cwd: projectRoot, packageRoot: repoRoot, noInteraction: true });
      await writeFile(
        join(projectRoot, ".claude/settings.json"),
        JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "foreign-claude" }] }] } }),
        "utf8",
      );
      await writeFile(
        join(projectRoot, ".codex/hooks.json"),
        JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "foreign-codex" }] }] } }),
        "utf8",
      );
      await writeFile(
        join(projectRoot, ".cursor/hooks.json"),
        JSON.stringify({ version: 1, hooks: { stop: [{ command: "foreign-cursor" }] } }),
        "utf8",
      );
      await updateConfig(projectRoot, (config) => {
        config.features.hooks = true;
        config.hookAgents = ["claude-code", "codex", "cursor"];
      });
      await runUpdate({ cwd: projectRoot, packageRoot: repoRoot });

      await updateConfig(projectRoot, (config) => {
        config.agents = [];
        config.hookAgents = [];
        config.features.mcp = false;
        config.features.hooks = false;
      });
      const before = await doctorTool(projectRoot, "0.1.0");
      expect(before.checks).toContainEqual(expect.objectContaining({ id: "agent-files-present", status: "fail" }));
      expect(before.checks).toContainEqual(expect.objectContaining({ id: "hooks-wired", status: "fail" }));

      const first = await runUpdate({ cwd: projectRoot, packageRoot: repoRoot });
      expect(first.operations.some((operation) => operation.status === "updated" || operation.status === "deleted")).toBe(true);

      const claude = await readFile(join(projectRoot, "CLAUDE.md"), "utf8");
      const agents = await readFile(join(projectRoot, "AGENTS.md"), "utf8");
      expect(claude).toContain("before claude\n\nafter claude");
      expect(claude).not.toContain("node-boost:start");
      expect(agents).toContain("before agents\n\nafter agents");
      expect(agents).not.toContain("node-boost:start");

      for (const path of [".mcp.json", ".cursor/mcp.json"]) {
        const parsed = JSON.parse(await readFile(join(projectRoot, path), "utf8")) as { mcpServers: Record<string, unknown> };
        expect(parsed.mcpServers.other).toEqual({ command: "other" });
        expect(parsed.mcpServers["node-boost"]).toBeUndefined();
      }
      const codexToml = await readFile(join(projectRoot, ".codex/config.toml"), "utf8");
      expect(codexToml).toContain("[mcp_servers.other]");
      expect(codexToml).not.toContain("mcp_servers.node-boost");

      for (const [path, foreign] of [
        [".claude/settings.json", "foreign-claude"],
        [".codex/hooks.json", "foreign-codex"],
        [".cursor/hooks.json", "foreign-cursor"],
      ] as const) {
        const content = await readFile(join(projectRoot, path), "utf8");
        expect(content).toContain(foreign);
        expect(content).not.toContain("node-boost guard --hook");
      }

      await expect(readFile(join(projectRoot, ".agents/skills/react-development/SKILL.md"), "utf8")).rejects.toThrow();
      await expect(readFile(join(projectRoot, ".claude/skills/react-development/SKILL.md"), "utf8")).rejects.toThrow();
      await expect(readFile(join(projectRoot, ".cursor/rules/node-boost.mdc"), "utf8")).rejects.toThrow();

      const after = await doctorTool(projectRoot, "0.1.0");
      expect(after.checks).toContainEqual(expect.objectContaining({ id: "agent-files-present", status: "pass" }));
      expect(after.checks).toContainEqual(expect.objectContaining({ id: "hooks-wired", status: "pass" }));

      const tree = await snapshotTree(projectRoot);
      const second = await runUpdate({ cwd: projectRoot, packageRoot: repoRoot });
      expect(second.operations.every((operation) => operation.status === "skipped")).toBe(true);
      expect(await snapshotTree(projectRoot)).toEqual(tree);
    });
  });

  it("preserves user content and merges agent MCP configuration", async () => {
    await withFixture("next-app", async (projectRoot) => {
      await writeFile(join(projectRoot, "CLAUDE.md"), "before claude\n\nafter claude\n", "utf8");
      await writeFile(join(projectRoot, "AGENTS.md"), "before agents\n\nafter agents\n", "utf8");
      await writeFile(
        join(projectRoot, ".mcp.json"),
        JSON.stringify({ mcpServers: { other: { command: "other", args: ["serve"] } } }, null, 2),
        "utf8",
      );
      await mkdir(join(projectRoot, ".codex"), { recursive: true });
      await writeFile(
        join(projectRoot, ".codex/config.toml"),
        '[mcp_servers.other]\ncommand = "other"\nargs = ["serve"]\n',
        "utf8",
      );

      await runInstall({ cwd: projectRoot, packageRoot: repoRoot, noInteraction: true });

      const claude = await readFile(join(projectRoot, "CLAUDE.md"), "utf8");
      const agents = await readFile(join(projectRoot, "AGENTS.md"), "utf8");
      const mcpJson = JSON.parse(await readFile(join(projectRoot, ".mcp.json"), "utf8")) as {
        mcpServers: Record<string, unknown>;
      };
      const codexToml = await readFile(join(projectRoot, ".codex/config.toml"), "utf8");

      expect(claude).toContain("before claude\n\nafter claude");
      expect(claude).toContain("<!-- node-boost:start -->");
      expect(agents).toContain("before agents\n\nafter agents");
      expect(agents).toContain(".agents/skills");
      expect(mcpJson.mcpServers.other).toEqual({ command: "other", args: ["serve"] });
      expect(mcpJson.mcpServers["node-boost"]).toEqual({ command: "npm", args: ["exec", "--", "node-boost", "mcp"] });
      expect(codexToml).toContain("[mcp_servers.other]");
      expect(codexToml).toContain("[mcp_servers.node-boost]");
    });
  });

  it("uses feature-modules forbid variant and writes object config", async () => {
    await withFixture("next-app", async (projectRoot) => {
      await runInstall({ cwd: projectRoot, packageRoot: repoRoot, noInteraction: true });

      const config = JSON.parse(await readFile(join(projectRoot, "node-boost.json"), "utf8")) as {
        architectures: unknown[];
      };
      const guideline = await readFile(join(projectRoot, ".ai/guidelines/architectures/feature-modules.md"), "utf8");

      expect(config.architectures).toContainEqual({ name: "feature-modules", boundary: "forbid" });
      expect(guideline).toContain("# Feature Modules (forbid boundary)");
    });
  });

  it("uses project overrides instead of built-in resources", async () => {
    await withFixture("next-app", async (projectRoot) => {
      await mkdir(join(projectRoot, ".node-boost/guidelines/next"), { recursive: true });
      await writeFile(join(projectRoot, ".node-boost/guidelines/next/16.md"), "# Custom Next 16 guidance\n", "utf8");

      await runInstall({ cwd: projectRoot, packageRoot: repoRoot, noInteraction: true });

      await expect(readFile(join(projectRoot, ".ai/guidelines/next/16.md"), "utf8")).resolves.toBe(
        "# Custom Next 16 guidance\n",
      );
    });
  });

  it("generates hook config when hooks feature is enabled and preserves foreign hooks", async () => {
    await withFixture("next-app", async (projectRoot) => {
      await mkdir(join(projectRoot, ".claude"), { recursive: true });
      await mkdir(join(projectRoot, ".codex"), { recursive: true });
      await mkdir(join(projectRoot, ".cursor"), { recursive: true });
      await writeFile(join(projectRoot, ".claude/settings.json"), JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "other" }] }] } }), "utf8");
      await writeFile(join(projectRoot, ".codex/hooks.json"), JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "other-codex" }] }] } }), "utf8");
      await writeFile(join(projectRoot, ".cursor/hooks.json"), JSON.stringify({ version: 1, hooks: { stop: [{ command: "other-cursor" }] } }), "utf8");

      const operations = await buildInstallOperations({
        packageRoot: repoRoot,
        projectRoot,
        stack: await detectStack(projectRoot),
        config: {
          version: 1,
          generatedWith: "0.1.0",
          stack: "next",
          agents: ["claude-code", "codex", "cursor"],
          features: { guidelines: true, skills: true, mcp: true, architecture: true, hooks: true },
          architectures: [{ name: "feature-modules", boundary: "forbid" }],
          audit: { exclude: [], rules: {}, ruleOptions: {} },
        },
      });

      const claude = parseJsonObject(readOperation(operations, ".claude/settings.json"));
      const codex = parseJsonObject(readOperation(operations, ".codex/hooks.json"));
      const cursor = parseJsonObject(readOperation(operations, ".cursor/hooks.json"));

      expect(JSON.stringify(claude)).toContain("other");
      expect(JSON.stringify(claude)).toContain("node-boost guard --hook claude-code");
      expect(JSON.stringify(codex)).toContain("other-codex");
      expect(JSON.stringify(codex)).toContain("node-boost guard --hook codex");
      expect(JSON.stringify(cursor)).toContain("other-cursor");
      expect(JSON.stringify(cursor)).toContain("node-boost guard --hook cursor");
    });
  });

  it("generates blocking hooks only for explicitly selected agents", async () => {
    await withFixture("next-app", async (projectRoot) => {
      const operations = await buildInstallOperations({
        packageRoot: repoRoot,
        projectRoot,
        stack: await detectStack(projectRoot),
        config: {
          version: 1,
          generatedWith: "0.1.0",
          stack: "next",
          agents: ["claude-code", "codex", "cursor"],
          hookAgents: ["codex"],
          features: { guidelines: true, skills: true, mcp: true, architecture: true, hooks: true },
          architectures: [],
          audit: { exclude: [], rules: {}, ruleOptions: {} },
        },
      });
      const paths = operations.map((operation) => operation.path);

      expect(paths).toContain(".codex/hooks.json");
      expect(paths).not.toContain(".claude/settings.json");
      expect(paths).not.toContain(".cursor/hooks.json");
    });
  });

  it("rejects a workspace root without stack and works from apps/web", async () => {
    await withTempDir(async (workspaceRoot) => {
      await writeFile(
        join(workspaceRoot, "package.json"),
        JSON.stringify({ private: true, workspaces: ["apps/*"] }, null, 2),
        "utf8",
      );
      await writeFile(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n", "utf8");
      await mkdir(join(workspaceRoot, "apps"), { recursive: true });
      await cp(join(repoRoot, "tests/fixtures/vite-app"), join(workspaceRoot, "apps/web"), { recursive: true });

      await expect(runInstall({ cwd: workspaceRoot, packageRoot: repoRoot, noInteraction: true })).rejects.toThrow(
        "Run node-boost in an app directory",
      );

      const result = await runInstall({ cwd: join(workspaceRoot, "apps/web"), packageRoot: repoRoot, noInteraction: true });

      expect(result.projectRoot).toBe(join(workspaceRoot, "apps/web"));
      await expectPath(join(workspaceRoot, "apps/web"), ".agents/skills/react-development/SKILL.md");
    });
  });
});

async function withFixture(fixtureName: string, fn: (projectRoot: string) => Promise<void>): Promise<void> {
  await withTempDir(async (projectRoot) => {
    await cp(join(repoRoot, "tests", "fixtures", fixtureName), projectRoot, { recursive: true });
    await fn(projectRoot);
  });
}

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "node-boost-"));

  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function snapshotTree(rootDir: string): Promise<Record<string, string>> {
  const files = await walk(rootDir);
  const snapshot: Record<string, string> = {};

  for (const file of files) {
    snapshot[relative(rootDir, file)] = await readFile(file, "utf8");
  }

  return Object.fromEntries(Object.entries(snapshot).sort(([a], [b]) => a.localeCompare(b)));
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);

      if (entry.isDirectory()) {
        return walk(path);
      }

      return entry.isFile() ? [path] : [];
    }),
  );

  return files.flat().sort((a, b) => a.localeCompare(b));
}

async function expectPath(projectRoot: string, path: string): Promise<void> {
  await expect(readFile(join(projectRoot, path), "utf8")).resolves.toBeTypeOf("string");
}

function readOperation(operations: Array<{ path: string; content: string }>, path: string): string {
  const operation = operations.find((item) => item.path === path);
  if (!operation) {
    throw new Error(`Missing operation ${path}`);
  }

  return operation.content;
}

function parseJsonObject(content: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(content);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Expected JSON object");
  }

  return parsed as Record<string, unknown>;
}

async function removeArchitecture(projectRoot: string, architecture: string): Promise<void> {
  const path = join(projectRoot, "node-boost.json");
  const config = JSON.parse(await readFile(path, "utf8")) as { architectures: Array<string | { name: string }> };
  config.architectures = config.architectures.filter((entry) =>
    typeof entry === "string" ? entry !== architecture : entry.name !== architecture,
  );
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

interface MutableTestConfig {
  agents: Array<"claude-code" | "codex" | "cursor">;
  hookAgents?: Array<"claude-code" | "codex" | "cursor">;
  features: { mcp: boolean; hooks: boolean };
}

async function updateConfig(projectRoot: string, mutate: (config: MutableTestConfig) => void): Promise<void> {
  const path = join(projectRoot, "node-boost.json");
  const config = JSON.parse(await readFile(path, "utf8")) as MutableTestConfig;
  mutate(config);
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

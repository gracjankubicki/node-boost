import { mkdtemp, readdir, readFile, rm, writeFile, cp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildInstallOperations, runInstall, runUpdate } from "../../src/install/orchestrator.js";
import { detectStack } from "../../src/detect/stack.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("install orchestrator", () => {
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
      await expectPath(projectRoot, ".ai/docs/llms.txt");
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
      expect(claude).toContain(".ai/docs/llms.txt");
      expect(agents).toContain("before agents\n\nafter agents");
      expect(agents).toContain(".agents/skills");
      expect(agents).toContain(".ai/docs/llms.txt");
      expect(mcpJson.mcpServers.other).toEqual({ command: "other", args: ["serve"] });
      expect(mcpJson.mcpServers["node-boost"]).toEqual({ command: "npm", args: ["exec", "node-boost", "mcp"] });
      expect(codexToml).toContain("[mcp_servers.other]");
      expect(codexToml).toContain("[mcp_servers.node-boost]");
    });
  });

  it("does not impose feature modules on a project without a feature tree", async () => {
    await withFixture("next-app", async (projectRoot) => {
      await runInstall({ cwd: projectRoot, packageRoot: repoRoot, noInteraction: true });

      const config = JSON.parse(await readFile(join(projectRoot, "node-boost.json"), "utf8")) as {
        architectures: unknown[];
      };
      expect(config.architectures).not.toContain("feature-modules");
      expect(config.architectures).not.toContainEqual(expect.objectContaining({ name: "feature-modules" }));
      await expect(readFile(join(projectRoot, ".ai/guidelines/architectures/feature-modules.md"), "utf8")).rejects.toThrow();
    });
  });

  it("infers a public-api boundary for an established feature tree", async () => {
    await withFixture("next-app", async (projectRoot) => {
      await mkdir(join(projectRoot, "src", "features", "invoices"), { recursive: true });
      await runInstall({ cwd: projectRoot, packageRoot: repoRoot, noInteraction: true });

      const config = JSON.parse(await readFile(join(projectRoot, "node-boost.json"), "utf8")) as {
        architectures: unknown[];
      };
      const guideline = await readFile(join(projectRoot, ".ai/guidelines/architectures/feature-modules.md"), "utf8");

      expect(config.architectures).toContainEqual({ name: "feature-modules", boundary: "public-api" });
      expect(guideline).toContain("# Feature Modules (public-api boundary)");
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

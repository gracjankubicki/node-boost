import { execFile } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NodeBoostConfigMissingError, runAudit } from "../../src/audit/engine.js";
import { formatClaudeCodeHook } from "../../src/hooks/claude-code.js";
import { formatCodexHook } from "../../src/hooks/codex.js";
import { formatCursorHook } from "../../src/hooks/cursor.js";
import { parseHookPayload } from "../../src/hooks/payload.js";

const execFileAsync = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("audit engine", () => {
  it("reports a readable setup error when node-boost.json is missing", async () => {
    await withTempProject(async (projectRoot) => {
      await expect(runAudit({ rootDir: projectRoot, mode: "all" })).rejects.toThrow(NodeBoostConfigMissingError);
      await expect(runAudit({ rootDir: projectRoot, mode: "all" })).rejects.toThrow("No node-boost.json found — run node-boost install first.");
    });
  });

  it("finds every E4 rule in dirty Next fixtures and leaves clean fixtures ok", async () => {
    await withFixture("dirty-next-app", async (projectRoot) => {
      const result = await runAudit({ rootDir: projectRoot, mode: "all" });
      const rules = new Set(result.findings.map((finding) => finding.rule));

      expect(result.ok).toBe(false);
      for (const rule of expectedArchitectureRules) {
        expect(rules).toContain(rule);
      }
      expect(result.err).toBeGreaterThan(0);
    });

    await withFixture("next-app", async (projectRoot) => {
      await writeConfig(projectRoot, "next", allArchitectures);
      const result = await runAudit({ rootDir: projectRoot, mode: "all" });

      expect(result.ok).toBe(true);
      expect(result.findings).toEqual([]);
    });
  });

  it("keeps next-only rules out of Vite and passes the clean Vite fixture", async () => {
    await withFixture("dirty-vite-app", async (projectRoot) => {
      const result = await runAudit({ rootDir: projectRoot, mode: "all" });
      const rules = new Set(result.findings.map((finding) => finding.rule));

      expect(rules).toContain("NB-ARCH-001");
      expect(rules).toContain("NB-ARCH-005");
      expect(rules).not.toContain("NB-ARCH-003");
      expect(rules).not.toContain("NB-ARCH-004");
      expect(rules).not.toContain("NB-ARCH-010");
    });

    await withFixture("vite-app", async (projectRoot) => {
      await writeConfig(projectRoot, "vite-react", allArchitectures);
      const result = await runAudit({ rootDir: projectRoot, mode: "all" });

      expect(result.ok).toBe(true);
      expect(result.findings).toEqual([]);
    });
  });

  it("treats only Vite modules containing JSX as client components", async () => {
    await withTempProject(async (projectRoot) => {
      await writeMinimalProject(projectRoot, { architectures: ["data-access-layer"] });
      await writeFile(join(projectRoot, "src", "transport.ts"), 'export const load = () => fetch("/api");\n', "utf8");
      await writeFile(join(projectRoot, "src", "NotAComponent.tsx"), 'export const load = () => fetch("/api");\n', "utf8");
      await writeFile(
        join(projectRoot, "src", "Widget.tsx"),
        'export function Widget() { fetch("/api"); return <main />; }\n',
        "utf8",
      );

      const result = await runAudit({ rootDir: projectRoot, mode: "all" });
      const findings = result.findings.filter((finding) => finding.rule === "NB-ARCH-005");

      expect(findings).toEqual([
        expect.objectContaining({ file: "src/Widget.tsx", line: 1 }),
      ]);
    });
  });

  it("recognizes conventional API files and api-suffixed directories as data layers", async () => {
    await withTempProject(async (projectRoot) => {
      await writeMinimalProject(projectRoot, { architectures: ["data-access-layer"] });
      await writeConfig(projectRoot, "next", ["data-access-layer"]);
      await mkdir(join(projectRoot, "src", "lib"), { recursive: true });
      await mkdir(join(projectRoot, "src", "workspace-api"), { recursive: true });
      await mkdir(join(projectRoot, "src", "components"), { recursive: true });
      await writeFile(join(projectRoot, "src", "lib", "api.ts"), '"use client";\nfetch("/api");\n', "utf8");
      await writeFile(join(projectRoot, "src", "workspace-api", "client.ts"), '"use client";\nfetch("/api");\n', "utf8");
      await writeFile(
        join(projectRoot, "src", "components", "api-card.tsx"),
        '"use client";\nexport function ApiCard() { fetch("/api"); return <main />; }\n',
        "utf8",
      );

      const result = await runAudit({ rootDir: projectRoot, mode: "all" });
      const findings = result.findings.filter((finding) => finding.rule === "NB-ARCH-005");

      expect(findings).toEqual([
        expect.objectContaining({ file: "src/components/api-card.tsx", line: 2 }),
      ]);
    });
  });

  it("does not report unresolved TypeScript modules for stylesheet imports", async () => {
    await withTempProject(async (projectRoot) => {
      await writeFeatureProject(projectRoot, "public-api", "index");
      await writeFile(
        join(projectRoot, "src", "features", "checkout", "View.tsx"),
        'import "./View.module.css";\nexport function View() { return <main />; }\n',
        "utf8",
      );

      const result = await runAudit({ rootDir: projectRoot, mode: "all" });

      expect(result.findings).not.toContainEqual(
        expect.objectContaining({ rule: "NB-META-006", ref: "./View.module.css" }),
      );
    });
  });

  it("handles parse errors and changed fallback without crashing", async () => {
    await withTempProject(async (projectRoot) => {
      await writeMinimalProject(projectRoot);
      await writeFile(join(projectRoot, "src", "broken.ts"), "export const = ;\n", "utf8");

      const syntax = await runAudit({ rootDir: projectRoot, mode: "all" });
      expect(syntax.findings).toContainEqual(expect.objectContaining({ rule: "NB-META-002", code: "parse-error" }));

      const changed = await runAudit({ rootDir: projectRoot, mode: "changed" });
      expect(changed.findings).toContainEqual(expect.objectContaining({ rule: "NB-META-004", code: "git-changed-fallback-all" }));
    });
  });

  it("supports suppression reasons, missing-reason warnings, ruleOptions, and feature boundary variants", async () => {
    await withFixture("dirty-next-app", async (projectRoot) => {
      const pagePath = join(projectRoot, "src/app/page.tsx");
      const page = await readFile(pagePath, "utf8");
      await writeFile(pagePath, `// nb-disable NB-ARCH-003 -- temporary page split\n${page}`, "utf8");

      const suppressed = await runAudit({ rootDir: projectRoot, mode: "all" });
      expect(suppressed.suppressed).toBeGreaterThan(0);
      expect(suppressed.findings).not.toContainEqual(expect.objectContaining({ rule: "NB-ARCH-003", file: "src/app/page.tsx" }));

      await writeFile(pagePath, `// nb-disable NB-ARCH-003\n${page}`, "utf8");
      const missingReason = await runAudit({ rootDir: projectRoot, mode: "all" });
      expect(missingReason.findings).toContainEqual(expect.objectContaining({ rule: "NB-META-001", code: "suppression-without-reason" }));
    });

    await withTempProject(async (projectRoot) => {
      await writeMinimalProject(projectRoot, {
        audit: { exclude: [], rules: {}, ruleOptions: { "NB-ARCH-005": { dataLayerGlobs: ["src/custom-data/**"] } } },
      });
      await mkdir(join(projectRoot, "src", "custom-data"), { recursive: true });
      await writeFile(join(projectRoot, "src", "custom-data", "client.tsx"), '"use client";\nfetch("/ok");\n', "utf8");

      const result = await runAudit({ rootDir: projectRoot, mode: "all" });
      expect(result.findings).not.toContainEqual(expect.objectContaining({ rule: "NB-ARCH-005" }));
    });

    await withTempProject(async (projectRoot) => {
      await writeFeatureProject(projectRoot, "public-api", "index");
      const publicApi = await runAudit({ rootDir: projectRoot, mode: "all" });
      expect(publicApi.findings).not.toContainEqual(expect.objectContaining({ rule: "NB-ARCH-001" }));

      await writeFeatureProject(projectRoot, "forbid", "index");
      const forbid = await runAudit({ rootDir: projectRoot, mode: "all" });
      expect(forbid.findings).toContainEqual(expect.objectContaining({ rule: "NB-ARCH-001" }));
      expect(forbid.findings).toContainEqual(expect.objectContaining({ rule: "NB-ARCH-002" }));
    });
  });

  it("resolves --base against merge-base and scans only changed files", async () => {
    await withTempProject(async (projectRoot) => {
      await writeMinimalProject(projectRoot, {
        architectures: ["typed-contracts"],
      });
      await writeFile(join(projectRoot, "src", "a.ts"), "export const a = process.env.API_A;\n", "utf8");
      await git(projectRoot, ["init", "-b", "main"]);
      await git(projectRoot, ["config", "user.email", "test@example.com"]);
      await git(projectRoot, ["config", "user.name", "Test"]);
      await git(projectRoot, ["add", "."]);
      await git(projectRoot, ["commit", "-m", "base"]);
      await git(projectRoot, ["checkout", "-b", "feature"]);
      await writeFile(join(projectRoot, "src", "b.ts"), "export const b = process.env.API_B;\n", "utf8");
      await git(projectRoot, ["add", "."]);
      await git(projectRoot, ["commit", "-m", "feature"]);

      const result = await runAudit({ rootDir: projectRoot, mode: "base", base: "main" });

      expect(result.findings).toContainEqual(expect.objectContaining({ rule: "NB-ARCH-008", file: "src/b.ts" }));
      expect(result.findings).not.toContainEqual(expect.objectContaining({ rule: "NB-ARCH-008", file: "src/a.ts" }));
    });
  });

  it("keeps full project context for project rules while scanning a base diff", async () => {
    await withTempProject(async (projectRoot) => {
      await writeMinimalProject(projectRoot, {
        architectures: ["error-loading-boundaries"],
      });
      await mkdir(join(projectRoot, "src", "app", "reports"), { recursive: true });
      await writeFile(join(projectRoot, "src", "app", "reports", "loading.tsx"), "export default function Loading() { return null; }\n", "utf8");
      await writeFile(join(projectRoot, "src", "app", "reports", "page.tsx"), "export default function Page() { return null; }\n", "utf8");
      await git(projectRoot, ["init", "-b", "main"]);
      await git(projectRoot, ["config", "user.email", "test@example.com"]);
      await git(projectRoot, ["config", "user.name", "Test"]);
      await git(projectRoot, ["add", "."]);
      await git(projectRoot, ["commit", "-m", "base"]);
      await git(projectRoot, ["checkout", "-b", "feature"]);
      await writeFile(
        join(projectRoot, "src", "app", "reports", "page.tsx"),
        "export default async function Page() { await Promise.resolve(); return null; }\n",
        "utf8",
      );
      await git(projectRoot, ["add", "."]);
      await git(projectRoot, ["commit", "-m", "async page"]);

      const result = await runAudit({ rootDir: projectRoot, mode: "base", base: "main" });

      expect(result.findings).not.toContainEqual(expect.objectContaining({ rule: "NB-ARCH-010" }));
    });
  });

  it("ignores deleted files and nested dependencies and includes mts and cts files", async () => {
    await withTempProject(async (projectRoot) => {
      await writeMinimalProject(projectRoot, {
        architectures: ["typed-contracts"],
      });
      await mkdir(join(projectRoot, "packages", "web", "node_modules", "nested"), { recursive: true });
      await writeFile(join(projectRoot, "src", "deleted.ts"), "export const deleted = true;\n", "utf8");
      await writeFile(join(projectRoot, "src", "renamed.ts"), "export const renamed = true;\n", "utf8");
      await git(projectRoot, ["init", "-b", "main"]);
      await git(projectRoot, ["config", "user.email", "test@example.com"]);
      await git(projectRoot, ["config", "user.name", "Test"]);
      await git(projectRoot, ["add", "."]);
      await git(projectRoot, ["commit", "-m", "base"]);
      await git(projectRoot, ["checkout", "-b", "feature"]);
      await rm(join(projectRoot, "src", "deleted.ts"));
      await git(projectRoot, ["mv", "src/renamed.ts", "src/renamed.mts"]);
      await writeFile(join(projectRoot, "src", "renamed.mts"), "export const renamed = process.env.RENAMED;\n", "utf8");
      await writeFile(join(projectRoot, "src", "module.mts"), "export const a = process.env.API_A;\n", "utf8");
      await writeFile(join(projectRoot, "src", "module.cts"), "export const b = process.env.API_B;\n", "utf8");
      await writeFile(
        join(projectRoot, "packages", "web", "node_modules", "nested", "ignored.ts"),
        "export const ignored = process.env.IGNORED;\n",
        "utf8",
      );

      const changed = await runAudit({ rootDir: projectRoot, mode: "changed" });

      expectScopeFindings(changed);

      await git(projectRoot, ["add", "."]);
      await git(projectRoot, ["commit", "-m", "changed source files"]);
      const base = await runAudit({ rootDir: projectRoot, mode: "base", base: "main" });

      expectScopeFindings(base);
    });
  });

  it("normalizes changed git paths when the project is a subdirectory", async () => {
    const repoDir = await mkdtemp(join(tmpdir(), "node-boost-monorepo-"));

    try {
      const appDir = join(repoDir, "apps", "web");
      await mkdir(join(repoDir, "src"), { recursive: true });
      await mkdir(join(appDir, "src"), { recursive: true });
      await writeMinimalProject(appDir, {
        architectures: ["typed-contracts"],
      });
      await writeFile(join(repoDir, "src", "outside.ts"), "export const outside = process.env.OUTSIDE;\n", "utf8");
      await writeFile(join(appDir, "src", "inside.ts"), "export const inside = process.env.INSIDE;\n", "utf8");
      await git(repoDir, ["init", "-b", "main"]);

      const result = await runAudit({ rootDir: appDir, mode: "changed" });

      expect(result.findings).toContainEqual(expect.objectContaining({ rule: "NB-ARCH-008", file: "src/inside.ts" }));
      expect(result.findings).not.toContainEqual(expect.objectContaining({ file: "src/outside.ts" }));
    } finally {
      await rm(repoDir, { recursive: true, force: true });
    }
  });

  it("formats hook adapter responses for Claude Code, Codex, and Cursor", async () => {
    const [claudePayload, codexPayload, cursorPayload] = await Promise.all([
      readPayload("claude-code-stop.json"),
      readPayload("codex-stop.json"),
      readPayload("cursor-stop.json"),
    ]);
    expect(parseHookPayload("claude-code", claudePayload).agent).toBe("claude-code");
    expect(parseHookPayload("codex", codexPayload).agent).toBe("codex");
    expect(parseHookPayload("cursor", cursorPayload).agent).toBe("cursor");

    await withFixture("dirty-next-app", async (projectRoot) => {
      const dirty = await runAudit({ rootDir: projectRoot, mode: "all" });
      const claude = formatClaudeCodeHook(dirty);
      const codex = formatCodexHook(dirty);
      const cursor = formatCursorHook(dirty);

      expect(claude.exitCode).toBe(2);
      expect(claude.stderr).toContain("node-boost guard found");
      expect(JSON.parse(codex.stdout)).toMatchObject({ continue: false });
      expect(JSON.parse(codex.stdout)).toHaveProperty("stopReason");
      expect(JSON.parse(cursor.stdout)).toHaveProperty("followup_message");
    });

    await withFixture("next-app", async (projectRoot) => {
      await writeConfig(projectRoot, "next", allArchitectures);
      const clean = await runAudit({ rootDir: projectRoot, mode: "all" });

      expect(formatClaudeCodeHook(clean)).toEqual({ exitCode: 0, stdout: "", stderr: "" });
      expect(JSON.parse(formatCodexHook(clean).stdout)).toEqual({ continue: true });
      expect(JSON.parse(formatCursorHook(clean).stdout)).toEqual({});
    });
  });
});

const expectedArchitectureRules = [
  "NB-ARCH-001",
  "NB-ARCH-002",
  "NB-ARCH-003",
  "NB-ARCH-004",
  "NB-ARCH-005",
  "NB-ARCH-006",
  "NB-ARCH-007",
  "NB-ARCH-008",
  "NB-ARCH-009",
  "NB-ARCH-010",
  "NB-ARCH-011",
  "NB-ARCH-012",
  "NB-ARCH-013",
  "NB-ARCH-014",
];

function expectScopeFindings(result: Awaited<ReturnType<typeof runAudit>>): void {
  expect(result.findings).toContainEqual(expect.objectContaining({ rule: "NB-ARCH-008", file: "src/module.mts" }));
  expect(result.findings).toContainEqual(expect.objectContaining({ rule: "NB-ARCH-008", file: "src/module.cts" }));
  expect(result.findings).toContainEqual(expect.objectContaining({ rule: "NB-ARCH-008", file: "src/renamed.mts" }));
  expect(result.findings).not.toContainEqual(expect.objectContaining({ file: "src/deleted.ts" }));
  expect(result.findings).not.toContainEqual(expect.objectContaining({ file: "packages/web/node_modules/nested/ignored.ts" }));
}

const allArchitectures = [
  { name: "feature-modules", boundary: "public-api" },
  "server-first-components",
  "data-access-layer",
  "typed-contracts",
  "state-management",
  "error-loading-boundaries",
  "secure-by-default",
  "modern-typescript",
];

async function withFixture(fixtureName: string, fn: (projectRoot: string) => Promise<void>): Promise<void> {
  await withTempProject(async (projectRoot) => {
    await cp(join(repoRoot, "tests", "fixtures", fixtureName), projectRoot, { recursive: true });
    await fn(projectRoot);
  }, false);
}

async function withTempProject(fn: (projectRoot: string) => Promise<void>, createDir = true): Promise<void> {
  const projectRoot = await mkdtemp(join(tmpdir(), "node-boost-audit-"));

  try {
    if (createDir) {
      await mkdir(join(projectRoot, "src"), { recursive: true });
    }
    await fn(projectRoot);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
}

async function writeMinimalProject(projectRoot: string, overrides: Record<string, unknown> = {}): Promise<void> {
  await mkdir(join(projectRoot, "src"), { recursive: true });
  await writeFile(
    join(projectRoot, "package.json"),
    JSON.stringify({ private: true, dependencies: { react: "^19.0.0", vite: "^6.0.0", "react-router": "^7.0.0" }, devDependencies: { typescript: "^5.9.3" } }, null, 2),
    "utf8",
  );
  await writeFile(join(projectRoot, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true } }, null, 2), "utf8");
  await writeConfig(projectRoot, "vite-react", overrides.architectures ?? ["data-access-layer", "typed-contracts", "modern-typescript"], overrides.audit);
}

async function writeFeatureProject(projectRoot: string, boundary: "public-api" | "forbid", importTarget: string): Promise<void> {
  await writeMinimalProject(projectRoot, {
    architectures: [{ name: "feature-modules", boundary }],
  });
  await mkdir(join(projectRoot, "src/features/cart"), { recursive: true });
  await mkdir(join(projectRoot, "src/features/checkout"), { recursive: true });
  await mkdir(join(projectRoot, "src/routes"), { recursive: true });
  await writeFile(join(projectRoot, "src/features/cart/index.ts"), "export const cart = {};\n", "utf8");
  await writeFile(join(projectRoot, "src/routes/app.ts"), "export default {};\n", "utf8");
  await writeFile(join(projectRoot, "src/features/checkout/useCheckout.ts"), `import { cart } from "../cart/${importTarget}";\nimport App from "../../routes/app";\nexport { cart, App };\n`, "utf8");
}

async function writeConfig(projectRoot: string, stack: string, architectures: unknown, audit: unknown = { exclude: [], rules: {}, ruleOptions: {} }): Promise<void> {
  await writeFile(
    join(projectRoot, "node-boost.json"),
    `${JSON.stringify(
      {
        version: 1,
        generatedWith: "0.1.0",
        stack,
        agents: ["claude-code", "codex", "cursor"],
        features: { guidelines: true, skills: true, mcp: true, architecture: true, hooks: false },
        architectures,
        audit,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

async function readPayload(name: string): Promise<string> {
  return readFile(join(repoRoot, "tests", "fixtures", "hook-payloads", name), "utf8");
}

async function git(cwd: string, args: string[]): Promise<void> {
  await execFileAsync("git", args, { cwd });
}

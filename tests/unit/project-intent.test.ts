import { mkdtemp, mkdir, readFile, writeFile, rm, symlink, lstat, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import packageJson from "../../package.json" with { type: "json" };
import { runInstall, runUpdate } from "../../src/install/orchestrator.js";
import { doctorTool } from "../../src/mcp/tools/doctor.js";
import { applicationInfoTool } from "../../src/mcp/tools/application-info.js";
import { runAudit } from "../../src/audit/engine.js";
import { parseNodeBoostConfig } from "../../src/config/schema.js";
import { detectStack } from "../../src/detect/stack.js";
import { detectTesting } from "../../src/detect/testing.js";
import { parseHookPayload } from "../../src/hooks/payload.js";
import { runGuardHook } from "../../src/hooks/adapter.js";

const packageRoot = join(import.meta.dirname, "../..");
async function project(stack: "astro" | "next" | "vite-react", action: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "nb-intent-"));
  try {
    await mkdir(join(root, "src"), { recursive: true });
    const deps = stack === "astro" ? { astro: "^6.0.0" } : stack === "next" ? { next: "^16.0.0", react: "^19.0.0" } : { vite: "^7.0.0", react: "^19.0.0" };
    await writeFile(join(root, "package.json"), JSON.stringify({ name: "intent-test", dependencies: deps }));
    await writeFile(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true } }));
    await writeFile(join(root, "src", "main.ts"), "export const ready = true;\n");
    await action(root);
  } finally { await rm(root, { recursive: true, force: true }); }
}
async function config(root: string, edit: (value: Record<string, unknown>) => void): Promise<void> {
  const path = join(root, "node-boost.json");
  const value = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
  edit(value); await writeFile(path, JSON.stringify(value));
}
const install = (root: string, profile?: string) => runInstall({ cwd: root, packageRoot, noInteraction: true, profile });
const update = (root: string) => runUpdate({ cwd: root, packageRoot });

describe("issue delivery: project intent and generated files", () => {
  it.skipIf(process.platform === "win32")("preserves a shared instruction file, converges and switches agents", async () => {
    await project("astro", async (root) => {
      await writeFile(join(root, "AGENTS.md"), "Manual instructions.\n");
      await symlink("AGENTS.md", join(root, "CLAUDE.md"));
      await install(root);
      expect((await lstat(join(root, "CLAUDE.md"))).isSymbolicLink()).toBe(true);
      const body = await readFile(join(root, "AGENTS.md"), "utf8");
      expect(body).toContain("Manual instructions.");
      expect(body).toContain(".agents/skills"); expect(body).toContain(".claude/skills");
      expect(body.match(/node-boost:start/g)).toHaveLength(1);
      expect((await doctorTool(root, packageJson.version)).ok).toBe(true);
      const before = (await stat(join(root, "AGENTS.md"))).mtimeMs;
      expect((await update(root)).operations.every((op) => op.status === "skipped")).toBe(true);
      expect((await stat(join(root, "AGENTS.md"))).mtimeMs).toBe(before);
      await config(root, (value) => { value.agents = ["codex"]; });
      await update(root);
      const single = await readFile(join(root, "AGENTS.md"), "utf8");
      expect(single).not.toContain(".claude/skills"); expect(single).toContain("Manual instructions.");
      expect((await doctorTool(root, packageJson.version)).ok).toBe(true);
    });
  });

  it("migrates opt-in single-agent skills and protects modified retired copies", async () => {
    await project("vite-react", async (root) => {
      await install(root);
      const source = ".ai/skills/react-development/SKILL.md";
      await writeFile(join(root, source), "Manual skill\n");
      await config(root, (value) => { value.agents = ["codex"]; value.skillLayout = "single-agent"; });
      const changed = await update(root);
      expect(changed.operations).toContainEqual(expect.objectContaining({ path: source, status: "conflict" }));
      expect(await readFile(join(root, source), "utf8")).toBe("Manual skill\n");
      expect(await readFile(join(root, "AGENTS.md"), "utf8")).not.toContain(".ai/skills");
      expect(await readFile(join(root, ".agents/skills/react-development/SKILL.md"), "utf8")).toContain("React");
      await rm(join(root, source));
      await update(root);
      expect((await doctorTool(root, packageJson.version)).ok).toBe(true);
      await config(root, (value) => { delete value.skillLayout; });
      await update(root);
      expect(await readFile(join(root, source), "utf8")).toContain("React");
      expect((await update(root)).operations.every((op) => op.status === "skipped")).toBe(true);
    });
  });

  it.each([ ["astro", "static-content-site"], ["astro", "server-app"], ["next", "static-content-site"], ["next", "server-app"], ["vite-react", "spa"] ] as const)("installs %s/%s and exposes declared intent", async (stack, profile) => {
    await project(stack, async (root) => {
      if (stack === "next") await writeFile(join(root, "next.config.mjs"), "export default { output: 'export' };\n");
      const first = await install(root, profile);
      expect(first.config.profile).toBe(profile);
      expect(first.config.architectures).toContain("testing-strategy");
      const info = await applicationInfoTool(root, packageJson.version);
      expect(info.declaredProfile).toBe(profile);
      expect(await readFile(join(root, ".agents/skills/project-profile/SKILL.md"), "utf8")).toContain(profile);
      const audit = await runAudit({ rootDir: root });
      expect(audit.findings.filter((item) => item.rule === "NB-PROFILE-001")).toEqual([]);
      expect((await doctorTool(root, packageJson.version)).ok).toBe(true);
      expect((await update(root)).operations.every((op) => op.status === "skipped")).toBe(true);
    });
  });

  it("rejects incompatible profiles and contradictory rendering variants", async () => {
    await project("vite-react", async (root) => {
      await expect(install(root, "server-app")).rejects.toThrow("does not support");
      await expect(install(root, "made-up")).rejects.toThrow();
      const result = await install(root, "spa");
      expect(() => parseNodeBoostConfig({ ...result.config, stack: "astro", profile: "static-content-site", architectures: [{ name: "rendering-strategy", variant: "server-first" }] })).toThrow("static-first");
    });
  });

  it("adds profile to an existing project without resetting overrides", async () => {
    await project("astro", async (root) => {
      await install(root);
      await config(root, (value) => { value.profile = "server-app"; value.architectures = ["secure-by-default"]; value.audit = { rules: { "NB-ARCH-011": "off" } }; value.hookAgents = ["codex"]; });
      const result = await update(root);
      expect(result.config.architectures).toEqual(["secure-by-default"]);
      expect(result.config.audit.rules["NB-ARCH-011"]).toBe("off"); expect(result.config.hookAgents).toEqual(["codex"]);
    });
  });

  it("wires earlier hooks only for selected agents and cleans them without removing foreign hooks", async () => {
    await project("vite-react", async (root) => {
      await install(root);
      await config(root, (value) => { value.features = { hooks: true }; value.hookAgents = ["codex"]; });
      await update(root);
      const path = join(root, ".codex/hooks.json");
      const hooks = JSON.parse(await readFile(path, "utf8")) as { hooks: Record<string, unknown[]> };
      expect(hooks.hooks.PostToolUse).toHaveLength(1); expect(hooks.hooks.Stop).toHaveLength(1);
      hooks.hooks.PostToolUse.push({ matcher: "Write", hooks: [{ type: "command", command: "foreign-hook" }] });
      await writeFile(path, JSON.stringify(hooks));
      await update(root);
      expect((await doctorTool(root, packageJson.version)).ok).toBe(true);
      await config(root, (value) => { value.features = { hooks: false }; });
      await update(root);
      const cleaned = JSON.parse(await readFile(path, "utf8")) as { hooks: Record<string, unknown[]> };
      expect(cleaned.hooks.Stop).toEqual([]);
      expect(cleaned.hooks.PostToolUse).toEqual([{ matcher: "Write", hooks: [{ type: "command", command: "foreign-hook" }] }]);
      expect((await update(root)).operations.every((operation) => operation.status === "skipped")).toBe(true);
    });
  });

  it.skipIf(process.platform === "win32")("does not retire a skill through a symlink to an active skill directory", async () => {
    await project("vite-react", async (root) => {
      await install(root);
      await rm(join(root, ".ai/skills"), { recursive: true });
      await symlink("../.agents/skills", join(root, ".ai/skills"));
      await config(root, (value) => { value.agents = ["codex"]; value.skillLayout = "single-agent"; });
      const result = await update(root);
      expect(result.operations).toContainEqual(expect.objectContaining({ path: ".ai/skills/react-development/SKILL.md", status: "conflict" }));
      expect(await readFile(join(root, ".agents/skills/react-development/SKILL.md"), "utf8")).toContain("React");
    });
  });

  it("reports static contract violations and dynamic detection honestly", async () => {
    await project("next", async (root) => {
      await writeFile(join(root, "next.config.mjs"), "export default { output: 'export' };\n");
      await install(root, "static-content-site");
      await writeFile(join(root, "src/main.ts"), "'use server'; export async function action() {}\n");
      expect((await runAudit({ rootDir: root })).findings).toContainEqual(expect.objectContaining({ rule: "NB-PROFILE-001", ref: "Server Actions" }));
      expect((await doctorTool(root, packageJson.version)).checks).toContainEqual(expect.objectContaining({ id: "profile-contract", status: "fail" }));
      await writeFile(join(root, "src/main.ts"), "export const safe = true;\n");
      await writeFile(join(root, "next.config.mjs"), "throw new Error('must never execute'); export default () => ({ output: 'export' });\n");
      expect((await runAudit({ rootDir: root })).findings).toContainEqual(expect.objectContaining({ rule: "NB-PROFILE-002" }));
    });
    await project("astro", async (root) => {
      await install(root, "static-content-site");
      await mkdir(join(root, "src/pages"));
      await writeFile(join(root, "src/pages/index.astro"), "---\nexport const prerender = false;\n---\n<h1>Hello</h1>");
      expect((await runAudit({ rootDir: root })).findings).toContainEqual(expect.objectContaining({ ref: "request-time route" }));
    });
    await project("vite-react", async (root) => {
      await install(root, "spa");
      await writeFile(join(root, "src/main.ts"), "import type { Hono } from 'hono'; import { type Request } from 'express'; export type Backend = Hono;\n");
      expect((await runAudit({ rootDir: root })).findings.filter((item) => item.rule === "NB-PROFILE-001")).toEqual([]);
      await writeFile(join(root, "vite.config.ts"), "export default { build: { ssr: true } };\n");
      expect((await runAudit({ rootDir: root })).findings).toContainEqual(expect.objectContaining({ ref: "SSR build" }));
    });
  });

  it.each([
    ["vite-react", "spa", "vite.config.mjs", "export default { build: { ...externalBuild } };"],
    ["vite-react", "spa", "vite.config.mjs", "export default { build: { ssr } };"],
    ["astro", "static-content-site", "astro.config.mjs", "export default { output: process.env.OUTPUT };"],
    ["astro", "static-content-site", "astro.config.mjs", "export default { ...externalConfig };"],
  ] as const)("reports unresolved configuration as unknown for %s: %s %s", async (stack, profile, filename, content) => {
    await project(stack, async (root) => {
      await install(root, profile);
      await writeFile(join(root, filename), `throw new Error('must never execute'); ${content}\n`);
      expect((await runAudit({ rootDir: root })).findings).toContainEqual(expect.objectContaining({ rule: "NB-PROFILE-002" }));
      const check = (await doctorTool(root, packageJson.version)).checks.find((item) => item.id === "profile-contract");
      expect(check?.status).toBe("warn");
    });
  });

  it.each([
    "export function GET(request: Request) { return Response.json({ url: request.url }); }",
    "export const GET = (request: Request) => Response.json({ url: request.url });",
    "export const GET = function(request: Request) { return Response.json({ url: request.url }); };",
  ])("rejects GET handlers reading request data: %s", async (handler) => {
    await project("next", async (root) => {
      await writeFile(join(root, "next.config.mjs"), "export default { output: 'export' };\n");
      await install(root, "static-content-site");
      await mkdir(join(root, "src/app/api/example"), { recursive: true });
      await writeFile(join(root, "src/app/api/example/route.ts"), handler);
      expect((await runAudit({ rootDir: root })).findings).toContainEqual(expect.objectContaining({ rule: "NB-PROFILE-001", ref: "GET reads request data" }));
      await writeFile(join(root, "src/app/api/example/route.ts"), handler.replace("{ url: request.url }", "{ static: true }"));
      expect((await runAudit({ rootDir: root })).findings.filter((item) => item.rule === "NB-PROFILE-001")).toEqual([]);
    });
  });

  it.each([
    ["backend.mjs", "import { createServer } from 'node:http'; createServer(() => {}).listen(3000);"],
    ["backend.cjs", "const { createServer } = require('node:http'); createServer(() => {}).listen(3000);"],
  ])("rejects own server sources in spa: %s", async (filename, content) => {
    await project("vite-react", async (root) => {
      await install(root, "spa");
      await writeFile(join(root, "src", filename), content);
      expect((await runAudit({ rootDir: root })).findings).toContainEqual(expect.objectContaining({ rule: "NB-PROFILE-001", file: `src/${filename}`, ref: "own server endpoint capability" }));
      expect((await doctorTool(root, packageJson.version)).checks).toContainEqual(expect.objectContaining({ id: "profile-contract", status: "fail" }));
    });
  });

  it("permits GET request references erased with TypeScript types", async () => {
    await project("next", async (root) => {
      await writeFile(join(root, "next.config.mjs"), "export default { output: 'export' };\n");
      await install(root, "static-content-site");
      await mkdir(join(root, "src/app/api/example"), { recursive: true });
      const handler = `export const GET = (request: Request) => {
        type RequestShape = typeof request;
        const url: RequestShape["url"] = "fixed";
        return Response.json({ url });
      };`;
      await writeFile(join(root, "src/app/api/example/route.ts"), handler);
      expect((await runAudit({ rootDir: root })).findings.filter((item) => item.rule === "NB-PROFILE-001")).toEqual([]);
      expect((await doctorTool(root, packageJson.version)).checks).toContainEqual(expect.objectContaining({ id: "profile-contract", status: "info" }));
      await writeFile(join(root, "src/app/api/example/route.ts"), handler.replace('= "fixed"', '= request.url'));
      expect((await runAudit({ rootDir: root })).findings).toContainEqual(expect.objectContaining({ rule: "NB-PROFILE-001", ref: "GET reads request data" }));
    });
  });
});

describe("test presence and early feedback", () => {
  it.each([".nvmrc", ".node-version"])("keeps unresolved %s support independent of the running process", async (filename) => {
    await project("vite-react", async (root) => {
      const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as Record<string, unknown>;
      pkg.scripts = { test: "node --test" }; pkg.engines = { node: ">=24.0.0" };
      await writeFile(join(root, "package.json"), JSON.stringify(pkg));
      await writeFile(join(root, filename), "lts/iron\n");
      const result = await detectTesting(root, {});
      expect(result.nodeTest).toEqual({ runtime: null, runtimeSource: "project", runtimeDeclaration: "lts/iron", runnerSupported: null, nativeTypeScript: null, typeStrippingDisabled: false });
      expect(result.testTools).not.toContain("node:test");
      pkg.engines = { node: "18.0.0" };
      await writeFile(join(root, "package.json"), JSON.stringify(pkg));
      expect((await detectTesting(root, {})).nodeTest).toEqual(result.nodeTest);
      await rm(join(root, filename));
      delete pkg.engines;
      await writeFile(join(root, "package.json"), JSON.stringify(pkg));
      expect((await detectTesting(root, {})).nodeTest).toMatchObject({ runtime: process.versions.node, runtimeSource: "process", runtimeDeclaration: null });
    });
  });

  it.each(["astro", "next", "vite-react"] as const)("detects node:test and one project warning for %s", async (stack) => {
    await project(stack, async (root) => {
      await install(root);
      await config(root, (value) => { value.architectures = ["testing-strategy"]; });
      const absent = await runAudit({ rootDir: root, mode: "paths", paths: ["src/main.ts"] });
      expect(absent.findings.filter((item) => item.rule === "NB-ARCH-015")).toHaveLength(1);
      await writeFile(join(root, "native.test.cjs"), "require('node:test').test('ok', () => {});\n");
      expect((await runAudit({ rootDir: root, mode: "paths", paths: ["src/main.ts"] })).findings.filter((item) => item.rule === "NB-ARCH-015")).toEqual([]);
      await rm(join(root, "native.test.cjs"));
      await writeFile(join(root, "domain.test.ts"), "import { test } from 'node:test'; test('ok', () => {});\n");
      expect((await runAudit({ rootDir: root, mode: "paths", paths: ["src/main.ts"] })).findings.filter((item) => item.rule === "NB-ARCH-015")).toEqual([]);
      await config(root, (value) => { value.audit = { exclude: ["**/*.test.ts"] }; });
      expect((await runAudit({ rootDir: root })).findings).toContainEqual(expect.objectContaining({ rule: "NB-ARCH-015" }));
      await config(root, (value) => { value.audit = { rules: { "NB-ARCH-015": "off" } }; });
      expect((await runAudit({ rootDir: root })).findings.filter((item) => item.rule === "NB-ARCH-015")).toEqual([]);
      const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as Record<string, unknown>;
      pkg.scripts = { test: "node --test" }; pkg.engines = { node: ">=22.18.0" };
      await writeFile(join(root, "package.json"), JSON.stringify(pkg));
      expect((await detectStack(root)).testTools).toContain("node:test");
      expect((await applicationInfoTool(root, packageJson.version)).nodeTest?.nativeTypeScript).toBe(true);
      pkg.engines = { node: "22.13.0" }; await writeFile(join(root, "package.json"), JSON.stringify(pkg));
      expect((await detectTesting(root, {})).nodeTest?.nativeTypeScript).toBe(false);
      pkg.scripts = { test: "node --experimental-strip-types --test" }; await writeFile(join(root, "package.json"), JSON.stringify(pkg));
      expect((await detectTesting(root, {})).nodeTest?.nativeTypeScript).toBe(true);
      pkg.scripts = { test: "node --no-strip-types --test" }; await writeFile(join(root, "package.json"), JSON.stringify(pkg));
      expect((await detectTesting(root, {})).nodeTest?.nativeTypeScript).toBe(false);
      pkg.scripts = { test: "echo 'node --test'" }; await writeFile(join(root, "package.json"), JSON.stringify(pkg));
      expect((await detectTesting(root, {})).testTools).not.toContain("node:test");
    });
  });

  it.each(["codex", "claude-code", "cursor"] as const)("reports edited findings without blocking for %s", async (agent) => {
    await project("vite-react", async (root) => {
      await install(root);
      await config(root, (value) => { value.architectures = ["modern-typescript", "testing-strategy"]; });
      await writeFile(join(root, "src/main.ts"), "export const value: any = 1;\n");
      const event = agent === "cursor" ? "postToolUse" : "PostToolUse";
      const payload = parseHookPayload(agent, JSON.stringify({ session_id: "test", cwd: root, hook_event_name: event,
        tool_name: agent === "codex" ? "apply_patch" : "Write", tool_input: agent === "codex" ? { command: "*** Begin Patch\n*** Update File: src/main.ts\n@@\n*** End Patch" } : { file_path: join(root, "src/main.ts") } }));
      const response = await runGuardHook(payload);
      expect(response.exitCode).toBe(0); expect(response.stdout).toContain("NB-ARCH-014");
      expect(response.stdout).not.toContain("NB-ARCH-015"); expect(response.stdout).not.toContain('"continue":false');
      expect(response.stdout).toContain(agent === "cursor" ? "additional_context" : "additionalContext");
      const outside = parseHookPayload(agent, JSON.stringify({ session_id: "test", cwd: root, hook_event_name: event, tool_name: "Write", tool_input: { file_path: join(root, "../outside.ts") } }));
      expect((await runGuardHook(outside)).stdout).toBe("{}\n");
    });
  });
});

import { execFile, spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const tsxCli = join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
const cliEntry = join(repoRoot, "src", "cli", "index.ts");

describe("guard CLI", () => {
  it("uses --base to audit the committed branch diff", async () => {
    await withGitProject(async (projectRoot) => {
      await writeFile(join(projectRoot, "src", "safe.ts"), "export const safe = true;\n", "utf8");
      await commitAll(projectRoot, "base");
      await git(projectRoot, ["checkout", "-b", "feature"]);
      await writeFile(join(projectRoot, "src", "unsafe.ts"), "export const token = process.env.SECRET_TOKEN;\n", "utf8");
      await commitAll(projectRoot, "violation");

      const guardResult = await runCli(projectRoot, ["guard", "--base", "main"]);
      const auditResult = await runCli(projectRoot, ["audit", "--base", "main", "--agent"]);
      const guardReport = JSON.parse(guardResult.stdout) as { scope: string; err: number; scanned: number; findings: unknown[] };
      const auditReport = JSON.parse(auditResult.stdout) as { scope: string; err: number; scanned: number; findings: unknown[] };

      expect(guardResult.exitCode).toBe(1);
      expect(auditResult.exitCode).toBe(1);
      expect(guardReport.scope).toBe("base");
      expect(guardReport.err).toBeGreaterThan(0);
      expect(guardReport.scanned).toBe(1);
      expect(guardReport).toEqual(auditReport);
    });
  }, 15_000);

  it("consumes hook stdin, uses payload cwd, and returns current native protocols", async () => {
    await withGitProject(async (projectRoot) => {
      await writeFile(join(projectRoot, "src", "safe.ts"), "export const safe = true;\n", "utf8");
      await commitAll(projectRoot, "base");
      await writeFile(join(projectRoot, "src", "unsafe.ts"), "export const token = process.env.SECRET_TOKEN;\n", "utf8");

      const codex = await runCliWithInput(
        repoRoot,
        ["guard", "--hook", "codex"],
        JSON.stringify({ session_id: "session-1", cwd: projectRoot, hook_event_name: "Stop", permission_mode: "default" }),
      );
      const claudeReentry = await runCliWithInput(
        repoRoot,
        ["guard", "--hook", "claude-code"],
        JSON.stringify({
          session_id: "session-2",
          cwd: projectRoot,
          hook_event_name: "Stop",
          permission_mode: "default",
          stop_hook_active: true,
        }),
      );
      const cursorReentry = await runCliWithInput(
        repoRoot,
        ["guard", "--hook", "cursor"],
        JSON.stringify({ hook_event_name: "stop", workspace_roots: [projectRoot], status: "completed", loop_count: 1 }),
      );
      const malformed = await runCliWithInput(repoRoot, ["guard", "--hook", "codex"], "{");
      const unsafeCwd = await runCliWithInput(
        repoRoot,
        ["guard", "--hook", "codex"],
        JSON.stringify({ session_id: "session-3", cwd: "relative/path", hook_event_name: "Stop" }),
      );

      expect(codex.exitCode).toBe(0);
      expect(JSON.parse(codex.stdout)).toMatchObject({ continue: false });
      expect(JSON.parse(codex.stdout)).toHaveProperty("stopReason");
      expect(claudeReentry).toEqual({ exitCode: 0, stdout: "", stderr: "" });
      expect(cursorReentry.exitCode).toBe(0);
      expect(JSON.parse(cursorReentry.stdout)).toEqual({});
      expect(malformed.exitCode).toBe(1);
      expect(malformed.stderr).toContain("Invalid codex hook payload");
      expect(malformed.stderr).not.toContain("at ");
      expect(unsafeCwd.exitCode).toBe(1);
      expect(unsafeCwd.stderr).toContain("Invalid codex hook payload");
    });
  }, 15_000);
});

async function withGitProject(fn: (projectRoot: string) => Promise<void>): Promise<void> {
  const projectRoot = await mkdtemp(join(tmpdir(), "node-boost-cli-"));

  try {
    await mkdir(join(projectRoot, "src"), { recursive: true });
    await writeFile(
      join(projectRoot, "package.json"),
      `${JSON.stringify({ private: true, dependencies: { react: "^19.0.0", vite: "^6.0.0", "react-router": "^7.0.0" } }, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      join(projectRoot, "node-boost.json"),
      `${JSON.stringify(
        {
          version: 1,
          generatedWith: "0.1.0",
          stack: "vite-react",
          agents: [],
          features: { guidelines: false, skills: false, mcp: false, architecture: true, hooks: false },
          architectures: ["typed-contracts"],
          audit: { exclude: [], rules: { "NB-ARCH-008": "err" }, ruleOptions: {} },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await git(projectRoot, ["init", "-b", "main"]);
    await git(projectRoot, ["config", "user.email", "test@example.com"]);
    await git(projectRoot, ["config", "user.name", "Test"]);
    await fn(projectRoot);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
}

async function commitAll(projectRoot: string, message: string): Promise<void> {
  await git(projectRoot, ["add", "."]);
  await git(projectRoot, ["commit", "-m", message]);
}

async function git(cwd: string, args: string[]): Promise<void> {
  await execFileAsync("git", args, { cwd });
}

async function runCli(cwd: string, args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  try {
    const result = await execFileAsync(process.execPath, [tsxCli, cliEntry, ...args], { cwd });
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    if (isExecError(error)) {
      return { exitCode: error.code, stdout: error.stdout, stderr: error.stderr };
    }

    throw error;
  }
}

function isExecError(error: unknown): error is Error & { code: number; stdout: string; stderr: string } {
  return error instanceof Error
    && "code" in error
    && typeof error.code === "number"
    && "stdout" in error
    && typeof error.stdout === "string"
    && "stderr" in error
    && typeof error.stderr === "string";
}

async function runCliWithInput(cwd: string, args: string[], input: string): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [tsxCli, cliEntry, ...args], { cwd, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });
    child.stdin.end(input);
  });
}

import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const tsxCli = join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
const cliEntry = join(repoRoot, "src", "cli", "index.ts");

describe("install and update CLI", () => {
  it("returns failure when install preserves a pre-existing generated path", async () => {
    await withProject(async (projectRoot) => {
      const generated = join(projectRoot, ".ai", "guidelines", "core.md");
      await mkdir(dirname(generated), { recursive: true });
      await writeFile(generated, "# pre-existing guidance\n", "utf8");

      const result = await runCli(projectRoot, ["install", "--no-interaction"]);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain("conflicts 1");
      expect(await readFile(generated, "utf8")).toBe("# pre-existing guidance\n");
    });
  }, 15_000);

  it("returns failure when update preserves a modified generated resource", async () => {
    await withProject(async (projectRoot) => {
      expect((await runCli(projectRoot, ["install", "--no-interaction"])).exitCode).toBe(0);
      const generated = join(projectRoot, ".ai", "guidelines", "core.md");
      await writeFile(generated, "# user-owned edit\n", "utf8");

      const result = await runCli(projectRoot, ["update"]);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain("conflicts 1");
      expect(await readFile(generated, "utf8")).toBe("# user-owned edit\n");
    });
  }, 15_000);
});

async function withProject(fn: (projectRoot: string) => Promise<void>): Promise<void> {
  const projectRoot = await mkdtemp(join(tmpdir(), "node-boost-lifecycle-cli-"));
  try {
    await cp(join(repoRoot, "tests", "fixtures", "vite-no-router"), projectRoot, { recursive: true });
    await fn(projectRoot);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
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

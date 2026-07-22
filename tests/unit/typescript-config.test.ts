import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runAudit } from "../../src/audit/engine.js";
import { runInstall } from "../../src/install/orchestrator.js";
import { readTypescriptStrict } from "../../src/mcp/project.js";
import { applicationInfoTool } from "../../src/mcp/tools/application-info.js";
import { doctorTool } from "../../src/mcp/tools/doctor.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("shared TypeScript config reader", () => {
  it.each(["./tsconfig.base", "./tsconfig.base.json"])("resolves JSONC extends %s consistently", async (extendsPath) => {
    const projectRoot = await mkdtemp(join(tmpdir(), "node-boost-tsconfig-"));

    try {
      await cp(join(repoRoot, "tests/fixtures/next-app"), projectRoot, { recursive: true });
      await runInstall({ cwd: projectRoot, packageRoot: repoRoot, noInteraction: true });
      await writeFile(
        join(projectRoot, "tsconfig.base.json"),
        '{\n  // shared strictness\n  "compilerOptions": {\n    "strict": true,\n  },\n}\n',
        "utf8",
      );
      await writeFile(
        join(projectRoot, "tsconfig.json"),
        `{\n  /* project config */\n  "extends": "${extendsPath}",\n}\n`,
        "utf8",
      );

      const strict = readTypescriptStrict(projectRoot);
      const [applicationInfo, doctor, audit] = await Promise.all([
        applicationInfoTool(projectRoot, "0.1.0"),
        doctorTool(projectRoot, "0.1.0"),
        runAudit({ rootDir: projectRoot, mode: "all" }),
      ]);

      expect(strict).toBe(true);
      expect(applicationInfo.typescript.strict).toBe(true);
      expect(doctor.checks).toContainEqual(expect.objectContaining({ id: "lint-strict", status: "pass" }));
      expect(audit.findings).not.toContainEqual(expect.objectContaining({ rule: "NB-ARCH-013" }));
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });
});

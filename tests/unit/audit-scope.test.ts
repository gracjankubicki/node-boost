import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveAuditScope } from "../../src/audit/scope.js";
import type { NodeBoostConfig } from "../../src/config/schema.js";

describe("audit scope", () => {
  it("skips generated skill directories that ship helper scripts", async () => {
    const root = await mkdtemp(join(tmpdir(), "node-boost-scope-"));
    try {
      for (const path of [
        "src/app/page.tsx",
        ".ai/skills/vercel-optimize/scripts/scan-codebase.mjs",
        ".claude/skills/vercel-optimize/scripts/scan-codebase.mjs",
        ".agents/skills/vercel-optimize/scripts/scan-codebase.mjs",
        ".claude/hooks/check.mjs",
      ]) {
        await mkdir(dirname(join(root, path)), { recursive: true });
        await writeFile(join(root, path), "export {};\n");
      }

      const scope = await resolveAuditScope({
        rootDir: root,
        config: { audit: { exclude: [] } } as unknown as NodeBoostConfig,
        mode: "all",
      });

      expect(scope.files).toEqual([".claude/hooks/check.mjs", "src/app/page.tsx"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

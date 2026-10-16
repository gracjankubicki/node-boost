import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveAuditScope } from "../../src/audit/scope.js";
import type { NodeBoostConfig } from "../../src/config/schema.js";

const config = { audit: { exclude: [] } } as unknown as NodeBoostConfig;
const projectFiles = [
  "src/app/page.tsx",
  ".ai/skills/vercel-optimize/scripts/scan-codebase.mjs",
  ".claude/skills/vercel-optimize/scripts/scan-codebase.mjs",
  ".agents/skills/vercel-optimize/scripts/scan-codebase.mjs",
  ".claude/hooks/check.mjs",
];
const roots: string[] = [];

async function createProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "node-boost-scope-"));
  roots.push(root);
  for (const path of projectFiles) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), "export {};\n");
  }
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("audit scope", () => {
  it("skips generated skill directories that ship helper scripts", async () => {
    const scope = await resolveAuditScope({ rootDir: await createProject(), config, mode: "all" });

    expect(scope.files).toEqual([".claude/hooks/check.mjs", "src/app/page.tsx"]);
  });

  it("skips generated skill directories when paths are passed explicitly", async () => {
    const scope = await resolveAuditScope({ rootDir: await createProject(), config, mode: "paths", paths: projectFiles });

    expect(scope.files).toEqual([".claude/hooks/check.mjs", "src/app/page.tsx"]);
    expect(scope.allPaths).toEqual([".claude/hooks/check.mjs", "src/app/page.tsx"]);
  });
});

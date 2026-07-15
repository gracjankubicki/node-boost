import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Project, SyntaxKind } from "ts-morph";
import { describe, expect, it } from "vitest";
import { runAudit } from "../../src/audit/engine.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("audit edge cases", () => {
  it("detects use client in a root App Router JSX entry", async () => {
    await withProject(async (projectRoot) => {
      await writeSource(projectRoot, "src/app/page.jsx", '"use client";\nexport default function Page() { return <main />; }');

      const result = await runAudit({ rootDir: projectRoot, mode: "all" });
      expect(result.findings).toContainEqual(expect.objectContaining({ rule: "NB-ARCH-003", file: "src/app/page.jsx", line: 1 }));
    });
  });

  it("requires a boundary for an async root page and accepts an existing boundary", async () => {
    await withProject(async (projectRoot) => {
      await writeSource(projectRoot, "app/page.tsx", "export default async function Page() { await Promise.resolve(); return null; }");

      const missing = await runAudit({ rootDir: projectRoot, mode: "all" });
      expect(missing.findings).toContainEqual(expect.objectContaining({ rule: "NB-ARCH-010", file: "app/page.tsx" }));

      await writeSource(projectRoot, "app/loading.tsx", "export default function Loading() { return null; }");
      const covered = await runAudit({ rootDir: projectRoot, mode: "all" });
      expect(covered.findings).not.toContainEqual(expect.objectContaining({ rule: "NB-ARCH-010", file: "app/page.tsx" }));
    });
  });

  it("recognizes schema parse calls structurally", async () => {
    await withProject(async (projectRoot) => {
      const path = "src/lib/api/client.ts";
      await writeSource(projectRoot, path, "export async function load(response: Response) { const raw = await response.json(); return schema.safeParse(raw); }");
      const validated = await runAudit({ rootDir: projectRoot, mode: "all" });
      expect(validated.findings).not.toContainEqual(expect.objectContaining({ rule: "NB-ARCH-007", file: path }));

      await writeSource(projectRoot, path, "export async function load(response: Response) { return await response.json(); }");
      const raw = await runAudit({ rootDir: projectRoot, mode: "all" });
      expect(raw.findings).toContainEqual(expect.objectContaining({ rule: "NB-ARCH-007", file: path }));
    });
  });

  it("distinguishes real network calls from comments and strings", async () => {
    await withProject(async (projectRoot) => {
      const path = "src/components/Widget.tsx";
      await writeSource(projectRoot, path, '"use client";\nconst note = "fetch(";\n// fetch("/comment")\nexport function Widget() { return null; }');
      const textOnly = await runAudit({ rootDir: projectRoot, mode: "all" });
      expect(textOnly.findings).not.toContainEqual(expect.objectContaining({ rule: "NB-ARCH-005", file: path }));

      await writeSource(projectRoot, path, '"use client";\nexport function Widget() { fetch("/api"); return null; }');
      const called = await runAudit({ rootDir: projectRoot, mode: "all" });
      expect(called.findings).toContainEqual(expect.objectContaining({ rule: "NB-ARCH-005", file: path, line: 2 }));
    });
  });

  it("treats createContext as a client-only API", async () => {
    await withProject(async (projectRoot) => {
      const path = "src/components/context.tsx";
      await writeSource(projectRoot, path, '"use client";\nimport { createContext } from "react";\nexport const Context = createContext(null);');

      const result = await runAudit({ rootDir: projectRoot, mode: "all" });
      expect(result.findings).not.toContainEqual(expect.objectContaining({ rule: "NB-ARCH-004", file: path }));
    });
  });

  it("contains no regular-expression literals in audit implementation", async () => {
    const project = new Project({ skipAddingFilesFromTsConfig: true });
    const files = await sourceFiles(join(repoRoot, "src", "audit"));
    const regexes = (await Promise.all(files.map(async (path) => {
      const source = project.createSourceFile(path, await readFile(path, "utf8"), { overwrite: true });
      return source.getDescendantsOfKind(SyntaxKind.RegularExpressionLiteral).map((node) => `${path}:${node.getStartLineNumber()}`);
    }))).flat();

    expect(regexes).toEqual([]);
  });
});

async function withProject(fn: (projectRoot: string) => Promise<void>): Promise<void> {
  const projectRoot = await mkdtemp(join(tmpdir(), "node-boost-edges-"));
  try {
    await mkdir(join(projectRoot, "src"), { recursive: true });
    await writeFile(join(projectRoot, "package.json"), JSON.stringify({ private: true, dependencies: { next: "^16.0.0", react: "^19.0.0" } }), "utf8");
    await writeFile(join(projectRoot, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true, jsx: "react-jsx" } }), "utf8");
    await writeFile(join(projectRoot, "node-boost.json"), `${JSON.stringify({
      version: 1,
      generatedWith: "0.1.0",
      stack: "next",
      agents: [],
      features: { guidelines: false, skills: false, mcp: false, architecture: true, hooks: false },
      architectures: ["server-first-components", "data-access-layer", "typed-contracts", "error-loading-boundaries"],
      audit: { exclude: [], rules: {}, ruleOptions: {} },
    }, null, 2)}\n`, "utf8");
    await fn(projectRoot);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
}

async function writeSource(projectRoot: string, path: string, content: string): Promise<void> {
  await mkdir(dirname(join(projectRoot, path)), { recursive: true });
  await writeFile(join(projectRoot, path), `${content}\n`, "utf8");
}

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? await sourceFiles(path) : entry.isFile() && entry.name.endsWith(".ts") ? [path] : [];
  }));
  return nested.flat();
}

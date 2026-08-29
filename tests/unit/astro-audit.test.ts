import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runAudit } from "../../src/audit/engine.js";

const execFileAsync = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("Astro audit", () => {
  it("reports high-confidence problems from the dirty Astro fixture", async () => {
    await withTempProject(async (projectRoot) => {
      await cp(join(repoRoot, "tests/fixtures/dirty-astro"), projectRoot, { recursive: true });

      const result = await runAudit({ rootDir: projectRoot, mode: "all" });

      expect(result.findings).toContainEqual(expect.objectContaining({
        rule: "NB-ARCH-011",
        file: "src/pages/index.astro",
        line: 11,
      }));
      expect(result.findings).toContainEqual(expect.objectContaining({
        rule: "NB-ARCH-012",
        file: "src/pages/index.astro",
        line: 5,
        ref: "PUBLIC_DATABASE_PASSWORD",
      }));
      expect(result.findings).toContainEqual(expect.objectContaining({
        rule: "NB-ASTRO-001",
        file: "src/pages/index.astro",
        line: 10,
        ref: "src/components/LeakyIsland.tsx:node:fs",
      }));
      expect(result.findings).toContainEqual(expect.objectContaining({
        rule: "NB-ASTRO-004",
        file: "package.json",
      }));
    });
  });

  it("maps frontmatter lines, accepts sanitizers, and suppresses template findings", async () => {
    await withAstroProject(
      ["secure-by-default"],
      [
        "---",
        'import DOMPurify from "dompurify";',
        'import { PUBLIC_API_TOKEN } from "astro:env/client";',
        'const raw = Astro.url.searchParams.get("html");',
        "const clean = DOMPurify.sanitize(raw);",
        "const password = import.meta.env.PUBLIC_DATABASE_PASSWORD;",
        "---",
        "<!-- nb-disable NB-ARCH-011 -- reviewed fixture -->",
        "<div set:html={raw} />",
        "<div set:html={raw} />",
        "<div set:html={clean} />",
        "<div set:html={'<p>static</p>'} />",
        "<p>{password}</p>",
      ].join("\n"),
      async (projectRoot) => {
        const result = await runAudit({ rootDir: projectRoot, mode: "all" });
        const htmlFindings = result.findings.filter((finding) => finding.rule === "NB-ARCH-011");
        const envFindings = result.findings.filter((finding) => finding.rule === "NB-ARCH-012");

        expect(htmlFindings).toEqual([expect.objectContaining({ line: 10 })]);
        expect(envFindings).toEqual([
          expect.objectContaining({ line: 3, ref: "PUBLIC_API_TOKEN" }),
          expect.objectContaining({ line: 6, ref: "PUBLIC_DATABASE_PASSWORD" }),
        ]);
        expect(result.suppressed).toBe(1);
      },
    );
  });

  it("reports unsupported Astro 7 and Tailwind 4 integrations and missing astro check", async () => {
    await withAstroProject(
      ["content-modeling", "styling-tailwind", "testing-strategy"],
      "---\n---\n<main />\n",
      async (projectRoot) => {
        await writePackage(projectRoot, {
          scripts: { build: "astro build" },
          dependencies: {
            astro: "^7.2.9",
            "@astrojs/db": "^0.16.0",
            tailwindcss: "^4.1.0",
            "@astrojs/tailwind": "^6.0.2",
          },
        });

        const result = await runAudit({ rootDir: projectRoot, mode: "all" });

        expect(result.findings).toContainEqual(expect.objectContaining({ rule: "NB-ASTRO-002", ref: "@astrojs/db" }));
        expect(result.findings).toContainEqual(expect.objectContaining({ rule: "NB-ASTRO-003", ref: "@astrojs/tailwind" }));
        expect(result.findings).toContainEqual(expect.objectContaining({ rule: "NB-ASTRO-004" }));
      },
    );
  });

  it("reports cached routes that read cookies or sessions", async () => {
    await withAstroProject(
      ["request-boundaries"],
      [
        "---",
        "export const cache = true;",
        'const account = Astro.cookies.get("account");',
        "---",
        "<p>{account?.value}</p>",
      ].join("\n"),
      async (projectRoot) => {
        const result = await runAudit({ rootDir: projectRoot, mode: "all" });

        expect(result.findings).toContainEqual(expect.objectContaining({
          rule: "NB-ASTRO-005",
          file: "src/pages/index.astro",
          line: 2,
        }));
      },
    );
  });

  it("checks feature-module imports in Astro frontmatter", async () => {
    await withAstroProject(
      [{ name: "feature-modules", boundary: "public-api" }],
      "---\n---\n<main />\n",
      async (projectRoot) => {
        await mkdir(join(projectRoot, "src/features/cart"), { recursive: true });
        await mkdir(join(projectRoot, "src/features/checkout"), { recursive: true });
        await writeFile(join(projectRoot, "src/features/cart/internal.ts"), "export const cart = {};\n", "utf8");
        await writeFile(
          join(projectRoot, "src/features/checkout/View.astro"),
          '---\nimport { cart } from "../cart/internal";\n---\n<p>{cart}</p>\n',
          "utf8",
        );

        const result = await runAudit({ rootDir: projectRoot, mode: "all" });

        expect(result.findings).toContainEqual(expect.objectContaining({
          rule: "NB-ARCH-001",
          file: "src/features/checkout/View.astro",
          line: 2,
          ref: "src/features/cart/internal.ts",
        }));
      },
    );
  });

  it("includes Astro files in changed and base scopes", async () => {
    await withAstroProject(
      ["secure-by-default"],
      "---\nconst html = '<p>safe</p>';\n---\n<div set:html={html} />\n",
      async (projectRoot) => {
        await git(projectRoot, ["init", "-b", "main"]);
        await git(projectRoot, ["config", "user.email", "test@example.com"]);
        await git(projectRoot, ["config", "user.name", "Test"]);
        await git(projectRoot, ["add", "."]);
        await git(projectRoot, ["commit", "-m", "base"]);
        await git(projectRoot, ["checkout", "-b", "feature"]);
        const pagePath = join(projectRoot, "src/pages/index.astro");
        const source = await readFile(pagePath, "utf8");
        await writeFile(pagePath, source.replace("'<p>safe</p>'", 'Astro.url.searchParams.get("html")'), "utf8");

        const changed = await runAudit({ rootDir: projectRoot, mode: "changed" });
        expect(changed.findings).toContainEqual(expect.objectContaining({ rule: "NB-ARCH-011", file: "src/pages/index.astro" }));

        await git(projectRoot, ["add", "."]);
        await git(projectRoot, ["commit", "-m", "unsafe html"]);
        const base = await runAudit({ rootDir: projectRoot, mode: "base", base: "main" });
        expect(base.findings).toContainEqual(expect.objectContaining({ rule: "NB-ARCH-011", file: "src/pages/index.astro" }));
      },
    );
  });
});

async function withAstroProject(
  architectures: unknown[],
  source: string,
  fn: (projectRoot: string) => Promise<void>,
): Promise<void> {
  await withTempProject(async (projectRoot) => {
    await mkdir(join(projectRoot, "src/pages"), { recursive: true });
    await writePackage(projectRoot, {
      scripts: { check: "astro check" },
      dependencies: { astro: "^7.2.9" },
      devDependencies: { typescript: "^6.0.3" },
    });
    await writeFile(join(projectRoot, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true } }), "utf8");
    await writeFile(join(projectRoot, "src/pages/index.astro"), source, "utf8");
    await writeFile(
      join(projectRoot, "node-boost.json"),
      `${JSON.stringify({
        version: 1,
        generatedWith: "0.4.0",
        stack: "astro",
        agents: [],
        features: { guidelines: false, skills: false, mcp: false, architecture: true, hooks: false },
        architectures,
        audit: { exclude: [], rules: {}, ruleOptions: {} },
      }, null, 2)}\n`,
      "utf8",
    );
    await fn(projectRoot);
  });
}

async function writePackage(projectRoot: string, value: Record<string, unknown>): Promise<void> {
  await writeFile(join(projectRoot, "package.json"), `${JSON.stringify({ private: true, ...value }, null, 2)}\n`, "utf8");
}

async function withTempProject(fn: (projectRoot: string) => Promise<void>): Promise<void> {
  const projectRoot = await mkdtemp(join(tmpdir(), "node-boost-astro-audit-"));
  try {
    await fn(projectRoot);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
}

async function git(cwd: string, args: string[]): Promise<void> {
  await execFileAsync("git", args, { cwd });
}

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runAudit } from "../../src/audit/engine.js";

describe("audit suppression", () => {
  it("limits a local directive to its own and the next line", async () => {
    await withProject(
      [
        "export const before = process.env.BEFORE;",
        "export const local = process.env.LOCAL; // nb-disable NB-ARCH-008 -- local exception",
        "export const safe = true;",
        "export const after = process.env.AFTER;",
      ].join("\n"),
      async (projectRoot) => {
        const result = await runAudit({ rootDir: projectRoot, mode: "all" });

        expect(result.suppressed).toBe(1);
        expect(result.findings.filter((finding) => finding.rule === "NB-ARCH-008")).toEqual([
          expect.objectContaining({ line: 1, ref: "BEFORE" }),
          expect.objectContaining({ line: 4, ref: "AFTER" }),
        ]);
      },
    );
  });

  it("suppresses the next line but not a finding two lines later", async () => {
    await withProject(
      [
        "export const before = process.env.BEFORE;",
        "// nb-disable NB-ARCH-008 -- next line exception",
        "export const next = process.env.NEXT;",
        "export const later = process.env.LATER;",
      ].join("\n"),
      async (projectRoot) => {
        const result = await runAudit({ rootDir: projectRoot, mode: "all" });

        expect(result.suppressed).toBe(1);
        expect(result.findings.filter((finding) => finding.rule === "NB-ARCH-008")).toEqual([
          expect.objectContaining({ line: 1, ref: "BEFORE" }),
          expect.objectContaining({ line: 4, ref: "LATER" }),
        ]);
      },
    );
  });

  it("applies a header directive to the whole file", async () => {
    await withProject(
      [
        "// nb-disable NB-ARCH-008 -- generated compatibility module",
        "export const first = process.env.FIRST;",
        "export const second = process.env.SECOND;",
      ].join("\n"),
      async (projectRoot) => {
        const result = await runAudit({ rootDir: projectRoot, mode: "all" });

        expect(result.suppressed).toBe(2);
        expect(result.findings).not.toContainEqual(expect.objectContaining({ rule: "NB-ARCH-008" }));
      },
    );
  });

  it("reads a directive from a block comment without reopening the file header", async () => {
    await withProject(
      [
        "export const before = process.env.BEFORE;",
        "/* nb-disable NB-ARCH-008 -- one local exception */ export const local = process.env.LOCAL;",
        "export const safe = true;",
        "export const later = process.env.LATER;",
      ].join("\n"),
      async (projectRoot) => {
        const result = await runAudit({ rootDir: projectRoot, mode: "all" });

        expect(result.suppressed).toBe(1);
        expect(result.findings.filter((finding) => finding.rule === "NB-ARCH-008")).toEqual([
          expect.objectContaining({ line: 1, ref: "BEFORE" }),
          expect.objectContaining({ line: 4, ref: "LATER" }),
        ]);
      },
    );
  });

  it("ignores directive text in a string literal", async () => {
    await withProject(
      [
        "export const note = '// nb-disable NB-ARCH-008 -- not a comment';",
        "export const visible = process.env.VISIBLE;",
      ].join("\n"),
      async (projectRoot) => {
        const result = await runAudit({ rootDir: projectRoot, mode: "all" });

        expect(result.suppressed).toBe(0);
        expect(result.findings).toContainEqual(expect.objectContaining({ rule: "NB-ARCH-008", line: 2, ref: "VISIBLE" }));
      },
    );
  });

  it("reports an unreasoned directive without suppressing the meta finding", async () => {
    await withProject(
      "export const local = process.env.LOCAL; // nb-disable NB-ARCH-008\n",
      async (projectRoot) => {
        const result = await runAudit({ rootDir: projectRoot, mode: "all" });

        expect(result.suppressed).toBe(1);
        expect(result.findings).toContainEqual(expect.objectContaining({
          rule: "NB-META-001",
          line: 1,
          code: "suppression-without-reason",
        }));
      },
    );
  });
});

async function withProject(source: string, fn: (projectRoot: string) => Promise<void>): Promise<void> {
  const projectRoot = await mkdtemp(join(tmpdir(), "node-boost-suppression-"));

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
          audit: { exclude: [], rules: {}, ruleOptions: {} },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeFile(join(projectRoot, "src", "example.ts"), `${source}\n`, "utf8");
    await fn(projectRoot);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
}

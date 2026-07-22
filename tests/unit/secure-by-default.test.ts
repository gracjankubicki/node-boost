import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runAudit } from "../../src/audit/engine.js";

describe("NB-ARCH-011", () => {
  it("reports every dynamic dangerouslySetInnerHTML shape", async () => {
    await withProject(
      [
        "const doNotSanitize = (value: string) => value;",
        "export function UnsafeHtml({ userInput }: { userInput: string }) {",
        "  const htmlProps = { __html: userInput };",
        "  return <>",
        "    <div dangerouslySetInnerHTML={{ __html: `<p>${userInput}</p>` }} />",
        "    <div",
        "      dangerouslySetInnerHTML={{",
        "        __html: userInput,",
        "      }}",
        "    />",
        "    <div dangerouslySetInnerHTML={htmlProps} />",
        "    <div dangerouslySetInnerHTML={{ __html: doNotSanitize(userInput) }} />",
        "  </>;",
        "}",
      ].join("\n"),
      {},
      async (projectRoot) => {
        const result = await runAudit({ rootDir: projectRoot, mode: "all" });
        const findings = result.findings.filter((finding) => finding.rule === "NB-ARCH-011");

        expect(findings).toHaveLength(4);
        expect(findings.map((finding) => finding.line)).toEqual([5, 7, 11, 12]);
      },
    );
  });

  it("accepts only static HTML and exact allowlisted sanitizer calls", async () => {
    await withProject(
      [
        'import DOMPurify from "dompurify";',
        "const userInput = '<p>unsafe</p>';",
        "const sanitizedProps = { __html: DOMPurify.sanitize(userInput) };",
        "export function SafeHtml() {",
        "  return <>",
        "    <div dangerouslySetInnerHTML={{ __html: '<p>static</p>' }} />",
        "    <div dangerouslySetInnerHTML={{ __html: `<p>static</p>` }} />",
        "    <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userInput) }} />",
        "    <div dangerouslySetInnerHTML={sanitizedProps} />",
        "    <div dangerouslySetInnerHTML={{ __html: security.clean(userInput) }} />",
        "  </>;",
        "}",
      ].join("\n"),
      { sanitizers: ["security.clean"] },
      async (projectRoot) => {
        const result = await runAudit({ rootDir: projectRoot, mode: "all" });

        expect(result.findings).not.toContainEqual(expect.objectContaining({ rule: "NB-ARCH-011" }));
      },
    );
  });
});

async function withProject(
  source: string,
  ruleOptions: Record<string, unknown>,
  fn: (projectRoot: string) => Promise<void>,
): Promise<void> {
  const projectRoot = await mkdtemp(join(tmpdir(), "node-boost-secure-"));

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
          architectures: ["secure-by-default"],
          audit: { exclude: [], rules: {}, ruleOptions: { "NB-ARCH-011": ruleOptions } },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeFile(join(projectRoot, "src", "html.tsx"), `${source}\n`, "utf8");
    await fn(projectRoot);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
}

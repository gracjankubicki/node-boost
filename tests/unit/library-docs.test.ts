import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  renderLibraryDocumentationLlmsTxt,
  resolveLibraryDocumentation,
} from "../../src/compose/library-docs.js";
import { detectStack } from "../../src/detect/stack.js";
import type { DetectedStack, PackageInfo } from "../../src/types.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("library documentation", () => {
  it("renders an llms.txt index and marks declared-range fallbacks honestly", async () => {
    const stack = await detectStack(join(repoRoot, "tests/fixtures/next-app"));
    const rendered = renderLibraryDocumentationLlmsTxt(stack);

    expect(rendered).toMatch(/^# Project library documentation\n\n> /);
    expect(rendered).toContain("## Version-matched documentation");
    expect(rendered).toContain("[next 16.2.9](https://nextjs.org/docs/llms.txt)");
    expect(rendered).toContain("[zod 4.0.0](https://zod.dev/llms.txt)");
    expect(rendered).toContain("inferred from declared range ^16.2.9");
    expect(rendered).not.toContain("## Upstream AI-readable indexes (secondary)");
    expect(rendered).not.toContain("[swr");
  });

  it("routes legacy majors and exact React Router versions to their archives", async () => {
    const detected = await detectStack(join(repoRoot, "tests/fixtures/next-app"));
    const stack: DetectedStack = {
      ...detected,
      packages: {
        next: pkg("next", "14.2.31"),
        react: pkg("react", "18.3.1"),
        "react-router-dom": pkg("react-router-dom", "6.30.4"),
        tailwindcss: pkg("tailwindcss", "3.4.17"),
      },
    };
    const entries = resolveLibraryDocumentation(stack);

    expect(entries).toEqual([
      expect.objectContaining({
        packageName: "next",
        preferredUrl: "https://nextjs.org/docs/14/llms.txt",
        preferredScope: "major",
        officialDocsUrl: "https://nextjs.org/docs/14",
        llmsScope: "major",
      }),
      expect.objectContaining({
        packageName: "react",
        preferredUrl: "https://18.react.dev/",
        preferredScope: "major",
      }),
      expect.objectContaining({
        packageName: "react-router-dom",
        preferredUrl: "https://reactrouter.com/6.30.4/start/overview",
        preferredScope: "exact",
      }),
      expect.objectContaining({
        packageName: "tailwindcss",
        preferredUrl: "https://v3.tailwindcss.com/docs/installation",
        preferredScope: "major",
      }),
    ]);
  });

  it("uses an exact package reference when only current upstream docs are available", async () => {
    const detected = await detectStack(join(repoRoot, "tests/fixtures/next-app"));
    const stack: DetectedStack = {
      ...detected,
      packages: {
        swr: pkg("swr", "2.3.4"),
      },
    };
    const [entry] = resolveLibraryDocumentation(stack);

    expect(entry).toMatchObject({
      packageName: "swr",
      preferredUrl: "https://www.npmjs.com/package/swr/v/2.3.4",
      preferredScope: "package",
      officialDocsUrl: "https://swr.vercel.app/docs/getting-started",
      officialDocsScope: "current",
      versionSource: "installed",
    });
  });
});

function pkg(name: string, version: string): PackageInfo {
  return {
    name,
    declaredRange: `^${version}`,
    version,
    major: Number.parseInt(version, 10),
    source: "node_modules",
  };
}

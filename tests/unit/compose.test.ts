import { describe, expect, it } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { composeGuidelines } from "../../src/compose/guidelines.js";
import { composeSkills } from "../../src/compose/skills.js";
import { detectStack } from "../../src/detect/stack.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("resource composition", () => {
  it("selects deterministic guidelines for a Next 16 project", async () => {
    const stack = await detectStack(join(repoRoot, "tests", "fixtures", "next-app"));
    const first = await composeGuidelines(repoRoot, stack);
    const second = await composeGuidelines(repoRoot, stack);

    expect(second).toEqual(first);
    expect(first.map((resource) => resource.sourcePath)).toEqual([
      "resources/react/guidelines/core.md",
      "resources/react/guidelines/next/16.md",
      "resources/react/guidelines/next/core.md",
      "resources/react/guidelines/react/19.md",
      "resources/react/guidelines/react/core.md",
      "resources/react/guidelines/tailwindcss/4.md",
      "resources/react/guidelines/tailwindcss/core.md",
      "resources/react/guidelines/testing/vitest.md",
      "resources/react/guidelines/typescript/core.md",
      "resources/react/guidelines/zod/4.md",
      "resources/react/guidelines/zod/core.md",
    ]);
  });

  it("selects only core resources when a major-specific file is not available", async () => {
    const stack = await detectStack(join(repoRoot, "tests", "fixtures", "vite-app"));
    const resources = await composeGuidelines(repoRoot, stack);
    const paths = resources.map((resource) => resource.sourcePath);

    expect(paths).toContain("resources/react/guidelines/vite/core.md");
    expect(paths).not.toContain("resources/react/guidelines/vite/6.md");
  });

  it("selects skills by detected stack and packages", async () => {
    const nextStack = await detectStack(join(repoRoot, "tests", "fixtures", "next-app"));
    const viteStack = await detectStack(join(repoRoot, "tests", "fixtures", "vite-app"));

    expect((await composeSkills(repoRoot, nextStack)).map((resource) => resource.sourcePath)).toEqual([
      "resources/react/skills/next-development/SKILL.md",
      "resources/react/skills/react-development/SKILL.md",
      "resources/react/skills/tailwindcss-development/SKILL.md",
      "resources/react/skills/testing-frontend/SKILL.md",
    ]);

    expect((await composeSkills(repoRoot, viteStack)).map((resource) => resource.sourcePath)).toEqual([
      "resources/react/skills/react-development/SKILL.md",
      "resources/react/skills/spa-routing/SKILL.md",
      "resources/react/skills/testing-frontend/SKILL.md",
    ]);
  });
});

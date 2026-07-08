import { describe, expect, it } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { composeGuidelines } from "../../src/compose/guidelines.js";
import { composeSkills } from "../../src/compose/skills.js";
import { detectStack } from "../../src/detect/stack.js";
import { buildInstallOperations } from "../../src/install/orchestrator.js";
import type { NodeBoostConfig } from "../../src/config/schema.js";

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

  it("snapshots composed .ai guidelines for Next and Vite fixtures", async () => {
    const nextStack = await detectStack(join(repoRoot, "tests", "fixtures", "next-app"));
    const viteStack = await detectStack(join(repoRoot, "tests", "fixtures", "vite-app"));

    const nextGuidelines = await generatedGuidelines("next", nextStack, [
      { name: "feature-modules", boundary: "forbid" },
      "server-first-components",
      "data-access-layer",
      "typed-contracts",
      "modern-typescript",
    ]);
    const viteGuidelines = await generatedGuidelines("vite-react", viteStack, [
      { name: "feature-modules", boundary: "public-api" },
      "data-access-layer",
      "typed-contracts",
      "state-management",
      "modern-typescript",
    ]);

    expect(nextGuidelines).toMatchSnapshot();
    expect(viteGuidelines).toMatchSnapshot();
  });
});

async function generatedGuidelines(stackName: "next" | "vite-react", stack: Awaited<ReturnType<typeof detectStack>>, architectures: NodeBoostConfig["architectures"]): Promise<Record<string, string>> {
  const operations = await buildInstallOperations({
    packageRoot: repoRoot,
    projectRoot: join(repoRoot, "tests", "fixtures", stackName === "next" ? "next-app" : "vite-app"),
    stack,
    config: {
      version: 1,
      generatedWith: "0.1.0",
      stack: stackName,
      agents: ["claude-code", "codex", "cursor"],
      features: { guidelines: true, skills: true, mcp: true, architecture: true, hooks: false },
      architectures,
      audit: { exclude: [], rules: {}, ruleOptions: {} },
    },
  });

  return Object.fromEntries(
    operations
      .filter((operation) => operation.path.startsWith(".ai/guidelines/"))
      .map((operation) => [operation.path, operation.content]),
  );
}

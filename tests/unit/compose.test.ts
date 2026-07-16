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

  it("selects Next 14 and React Router 6 version resources", async () => {
    const nextStack = await detectStack(join(repoRoot, "tests", "fixtures", "next-app"));
    nextStack.packages.next = { ...nextStack.packages.next, version: "14.2.0", major: 14 };
    const viteStack = await detectStack(join(repoRoot, "tests", "fixtures", "vite-app"));
    viteStack.packages["react-router"] = { ...viteStack.packages["react-router"], version: null, major: null };
    viteStack.packages["react-router-dom"] = {
      name: "react-router-dom",
      declaredRange: "^6.28.0",
      version: "6.28.0",
      major: 6,
      source: "range",
    };

    expect((await composeGuidelines(repoRoot, nextStack)).map((item) => item.sourcePath)).toContain(
      "resources/react/guidelines/next/14.md",
    );
    expect((await composeGuidelines(repoRoot, viteStack)).map((item) => item.sourcePath)).toContain(
      "resources/react/guidelines/react-router/6.md",
    );
  });

  it("selects skills by detected stack and packages", async () => {
    const nextStack = await detectStack(join(repoRoot, "tests", "fixtures", "next-app"));
    const viteStack = await detectStack(join(repoRoot, "tests", "fixtures", "vite-app"));

    expect((await composeSkills(repoRoot, nextStack)).map((resource) => resource.sourcePath)).toEqual([
      "resources/react/skills/next-development/SKILL.md",
      "resources/react/skills/project-conventions-and-validation/SKILL.md",
      "resources/react/skills/react-development/SKILL.md",
      "resources/react/skills/tailwindcss-development/SKILL.md",
      "resources/react/skills/testing-frontend/SKILL.md",
    ]);

    expect((await composeSkills(repoRoot, viteStack)).map((resource) => resource.sourcePath)).toEqual([
      "resources/react/skills/project-conventions-and-validation/SKILL.md",
      "resources/react/skills/react-development/SKILL.md",
      "resources/react/skills/spa-routing/SKILL.md",
      "resources/react/skills/testing-frontend/SKILL.md",
    ]);
  });

  it("does not install duplicate Tailwind and testing skills when architecture skills are selected", async () => {
    const stack = await detectStack(join(repoRoot, "tests", "fixtures", "next-app"));
    const resources = await composeSkills(repoRoot, stack, [
      { name: "styling-tailwind", options: {} },
      { name: "testing-strategy", options: {} },
    ]);
    const paths = resources.map((resource) => resource.sourcePath);

    expect(paths).toContain("resources/react/architectures/styling-tailwind/skill/SKILL.md");
    expect(paths).toContain("resources/react/architectures/testing-strategy/skill/SKILL.md");
    expect(paths).not.toContain("resources/react/skills/tailwindcss-development/SKILL.md");
    expect(paths).not.toContain("resources/react/skills/testing-frontend/SKILL.md");
  });

  it("composes capability-specific resources for an established frontend stack", async () => {
    const stack = await detectStack(join(repoRoot, "tests", "fixtures", "vite-app"));
    const addPackage = (name: string, version = "1.0.0") => {
      stack.packages[name] = {
        name,
        declaredRange: `^${version}`,
        version,
        major: Number.parseInt(version, 10),
        source: "range",
      };
    };

    for (const packageName of [
      "swr",
      "valibot",
      "react-hook-form",
      "@storybook/react",
      "@mantine/core",
      "i18next",
      "html-react-parser",
      "orval",
      "msw",
    ]) {
      addPackage(packageName);
    }

    const guidelinePaths = (await composeGuidelines(repoRoot, stack)).map((resource) => resource.sourcePath);
    const skillPaths = (await composeSkills(repoRoot, stack)).map((resource) => resource.sourcePath);

    for (const path of [
      "resources/react/guidelines/swr/core.md",
      "resources/react/guidelines/valibot/core.md",
      "resources/react/guidelines/react-hook-form/core.md",
      "resources/react/guidelines/storybook/core.md",
      "resources/react/guidelines/mantine/core.md",
      "resources/react/guidelines/i18n/core.md",
      "resources/react/guidelines/testing/msw.md",
    ]) {
      expect(guidelinePaths).toContain(path);
    }

    for (const path of [
      "resources/react/skills/swr-data-access/SKILL.md",
      "resources/react/skills/forms-and-runtime-validation/SKILL.md",
      "resources/react/skills/storybook-component-workflow/SKILL.md",
      "resources/react/skills/mantine-development/SKILL.md",
      "resources/react/skills/localization-workflow/SKILL.md",
      "resources/react/skills/trusted-rich-text-rendering/SKILL.md",
      "resources/react/skills/orval-react-query-kit/SKILL.md",
    ]) {
      expect(skillPaths).toContain(path);
    }
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

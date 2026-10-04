import { join, posix } from "node:path";
import { richTextPackageNames } from "../ecosystem/packages.js";
import type { DetectedStack, NormalizedArchitecture, ResourceSelection } from "../types.js";
import { listResourceFiles, resourceFileExists } from "./resources.js";

export async function composeSkills(
  rootDir: string,
  stack: DetectedStack,
  architectures: NormalizedArchitecture[] = [],
): Promise<ResourceSelection[]> {
  if (stack.name === "astro" && stack.astro) {
    return composeAstroSkills(rootDir, stack, architectures);
  }

  const availableFiles = await listResourceFiles(rootDir, "skills");
  const selected = new Set<string>();
  const architectureNames = new Set(architectures.map((architecture) => architecture.name));

  if (stack.packages.react?.version) {
    selected.add("project-conventions-and-validation/SKILL.md");
    selected.add("react-development/SKILL.md");
  }

  if (stack.packages.swr?.version) {
    selected.add("swr-data-access/SKILL.md");
  }

  if (stack.packages["react-hook-form"]?.version) {
    selected.add("forms-and-runtime-validation/SKILL.md");
  }

  if (stack.packages.storybook?.version || stack.packages["@storybook/react"]?.version) {
    selected.add("storybook-component-workflow/SKILL.md");
  }

  if (stack.packages["@mantine/core"]?.version) {
    selected.add("mantine-development/SKILL.md");
  }

  if (
    stack.packages.i18next?.version ||
    stack.packages["react-i18next"]?.version ||
    stack.packages["@lingui/core"]?.version
  ) {
    selected.add("localization-workflow/SKILL.md");
  }

  if (richTextPackageNames.some((packageName) => stack.packages[packageName]?.version)) {
    selected.add("trusted-rich-text-rendering/SKILL.md");
  }

  if (stack.packages.orval?.version || stack.packages["react-query-kit"]?.version) {
    selected.add("orval-react-query-kit/SKILL.md");
  }

  if (stack.name === "next") {
    selected.add("next-development/SKILL.md");
  }

  if (stack.name === "vite-react" && stack.router === "react-router") {
    selected.add("spa-routing/SKILL.md");
  }

  if (stack.packages.tailwindcss?.version && !architectureNames.has("styling-tailwind")) {
    selected.add("tailwindcss-development/SKILL.md");
  }

  if (
    (stack.testTools?.includes("node:test") || stack.packages.vitest?.version ||
      stack.packages.jest?.version ||
      stack.packages.playwright?.version ||
      stack.packages.storybook?.version ||
      stack.packages["@storybook/react"]?.version) &&
    !architectureNames.has("testing-strategy")
  ) {
    selected.add("testing-frontend/SKILL.md");
  }

  const packageSkills = [...selected]
    .filter((file) => availableFiles.includes(file))
    .sort((a, b) => a.localeCompare(b))
    .map((file) => ({
      kind: "skill",
      sourcePath: join("resources", "react", "skills", file),
      outputPath: posix.join(".ai", "skills", file),
    }) satisfies ResourceSelection);

  const architectureSkills = await Promise.all(architectures.map((architecture) => architectureSkill(
    rootDir,
    stack,
    architecture,
  )));

  return [...packageSkills, ...architectureSkills].sort((a, b) => a.outputPath.localeCompare(b.outputPath));
}

async function composeAstroSkills(
  rootDir: string,
  stack: DetectedStack,
  architectures: NormalizedArchitecture[],
): Promise<ResourceSelection[]> {
  const astroRoot = join("resources", "stacks", "astro");
  const availableFiles = await listResourceFiles(rootDir, "skills", astroRoot);
  const selected = new Set<string>(["astro-development/SKILL.md", "routing-rendering/SKILL.md"]);
  if (stack.astro?.clientIslands || stack.astro?.serverIslands) {
    selected.add("islands/SKILL.md");
  }
  if (stack.astro?.contentCollections !== "none") {
    selected.add("content-collections/SKILL.md");
  }
  if (stack.astro && (stack.astro.actions || stack.astro.middleware || stack.astro.sessions || stack.astro.routeCache || stack.astro.endpoints)) {
    selected.add("server-runtime/SKILL.md");
  }
  if ((stack.astro?.testTools.length ?? 0) > 0) {
    selected.add("testing/SKILL.md");
  }
  if (stack.astro?.htmlInjection) {
    selected.add("safe-html/SKILL.md");
  }

  const astroSkills = [...selected]
    .filter((file) => availableFiles.includes(file))
    .sort((a, b) => a.localeCompare(b))
    .map((file) => ({
      kind: "skill",
      sourcePath: join(astroRoot, "skills", file),
      outputPath: posix.join(".ai", "skills", "astro", file),
    }) satisfies ResourceSelection);
  const frameworkSkills = (stack.astro?.uiIntegrations ?? []).map((framework) => ({
    kind: "skill",
    sourcePath: join("resources", "frameworks", framework, "skills", "development", "SKILL.md"),
    outputPath: posix.join(".ai", "skills", "frameworks", framework, "development", "SKILL.md"),
  }) satisfies ResourceSelection);
  const architectureSkills = await Promise.all(architectures.map((architecture) => architectureSkill(
    rootDir,
    stack,
    architecture,
  )));

  return [...astroSkills, ...frameworkSkills, ...architectureSkills]
    .sort((a, b) => a.outputPath.localeCompare(b.outputPath));
}

async function architectureSkill(
  rootDir: string,
  stack: DetectedStack,
  architecture: NormalizedArchitecture,
): Promise<ResourceSelection> {
  const astroPath = join("resources", "stacks", "astro", "architectures", architecture.name, "skill", "SKILL.md");
  const sourcePath = stack.name === "astro" && await resourceFileExists(rootDir, astroPath)
    ? astroPath
    : join("resources", "react", "architectures", architecture.name, "skill", "SKILL.md");
  return {
    kind: "skill",
    sourcePath,
    outputPath: posix.join(".ai", "skills", architecture.name, "SKILL.md"),
  };
}

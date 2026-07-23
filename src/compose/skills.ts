import { join, posix } from "node:path";
import { richTextPackageNames } from "../ecosystem/packages.js";
import type { DetectedStack, NormalizedArchitecture, ResourceSelection } from "../types.js";
import { listResourceFiles } from "./resources.js";

export async function composeSkills(
  rootDir: string,
  stack: DetectedStack,
  architectures: NormalizedArchitecture[] = [],
): Promise<ResourceSelection[]> {
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
    (stack.packages.vitest?.version ||
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

  const architectureSkills = architectures.map((architecture) => ({
    kind: "skill",
    sourcePath: join("resources", "react", "architectures", architecture.name, "skill", "SKILL.md"),
    outputPath: posix.join(".ai", "skills", architecture.name, "SKILL.md"),
  }) satisfies ResourceSelection);

  return [...packageSkills, ...architectureSkills].sort((a, b) => a.outputPath.localeCompare(b.outputPath));
}

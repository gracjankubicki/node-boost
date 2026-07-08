import type { DetectedStack, NormalizedArchitecture, ResourceSelection } from "../types.js";

export function renderGuidelinesIndex(
  stack: DetectedStack,
  architectures: NormalizedArchitecture[],
  guidelines: ResourceSelection[],
): string {
  const packages = Object.values(stack.packages)
    .filter((pkg) => pkg.version)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((pkg) => `- ${pkg.name}: ${pkg.version} (${pkg.source})`);

  const architectureLines = architectures.map((architecture) => {
    const suffix = architecture.name === "feature-modules" ? ` (${featureModulesBoundary(architecture)})` : "";
    return `- ${architecture.name}${suffix}`;
  });

  const fileLines = guidelines
    .map((guideline) => `- ${guideline.outputPath}: ${sourceLabel(guideline.sourcePath)}`)
    .sort((a, b) => a.localeCompare(b));

  return [
    "# node-boost guidelines",
    "",
    "## Stack",
    "",
    `- name: ${stack.name}`,
    `- router: ${stack.router}`,
    `- package manager: ${stack.packageManager.name}`,
    `- linting: ${stack.linting}`,
    "",
    "## Packages",
    "",
    ...(packages.length ? packages : ["- none detected"]),
    "",
    "## Architectures",
    "",
    ...(architectureLines.length ? architectureLines : ["- none selected"]),
    "",
    "## Files",
    "",
    ...fileLines,
    "",
  ].join("\n");
}

function sourceLabel(sourcePath: string): string {
  return sourcePath.includes(".node-boost") ? "project override" : "node-boost built-in";
}

function featureModulesBoundary(architecture: NormalizedArchitecture): string {
  return typeof architecture.options.boundary === "string" ? architecture.options.boundary : "public-api";
}

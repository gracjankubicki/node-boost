import { join, posix } from "node:path";
import type { DetectedStack, NormalizedArchitecture, ResourceSelection } from "../types.js";
import { listResourceFiles } from "./resources.js";

const packageResourceMap: Record<string, string> = {
  react: "react",
  next: "next",
  vite: "vite",
  "react-router": "react-router",
  "react-router-dom": "react-router",
  zod: "zod",
  valibot: "valibot",
  "@tanstack/react-query": "react-query",
  "react-query-kit": "react-query",
  swr: "swr",
  zustand: "zustand",
  "react-hook-form": "react-hook-form",
  storybook: "storybook",
  "@storybook/react": "storybook",
  "@mantine/core": "mantine",
  i18next: "i18n",
  "react-i18next": "i18n",
  "@lingui/core": "i18n",
  typescript: "typescript",
  tailwindcss: "tailwindcss",
  vitest: "testing",
  playwright: "testing",
};

export async function composeGuidelines(
  rootDir: string,
  stack: DetectedStack,
  architectures: NormalizedArchitecture[] = [],
): Promise<ResourceSelection[]> {
  const availableFiles = await listResourceFiles(rootDir, "guidelines");
  const selected = new Set<string>(["core.md"]);

  for (const [packageName, resourceName] of Object.entries(packageResourceMap)) {
    const packageInfo = stack.packages[packageName];

    if (!packageInfo?.version) {
      continue;
    }

    addIfAvailable(selected, availableFiles, `${resourceName}/core.md`);

    if (packageInfo.major !== null) {
      addIfAvailable(selected, availableFiles, `${resourceName}/${packageInfo.major}.md`);
    }
  }

  if (stack.packages.vitest?.version) {
    addIfAvailable(selected, availableFiles, "testing/vitest.md");
  }

  if (stack.packages.jest?.version) {
    addIfAvailable(selected, availableFiles, "testing/jest.md");
  }

  if (stack.packages.playwright?.version) {
    addIfAvailable(selected, availableFiles, "testing/playwright.md");
  }

  if (stack.packages.msw?.version) {
    addIfAvailable(selected, availableFiles, "testing/msw.md");
  }

  const packageGuidelines = [...selected]
    .sort((a, b) => a.localeCompare(b))
    .map((file) => ({
      kind: "guideline",
      sourcePath: join("resources", "react", "guidelines", file),
      outputPath: posix.join(".ai", "guidelines", file),
    }) satisfies ResourceSelection);

  const architectureGuidelines = architectures.map((architecture) => ({
    kind: "guideline",
    sourcePath: join("resources", "react", "architectures", architecture.name, architectureVariantPath(architecture)),
    outputPath: posix.join(".ai", "guidelines", "architectures", `${architecture.name}.md`),
  }) satisfies ResourceSelection);

  return [...packageGuidelines, ...architectureGuidelines].sort((a, b) => a.outputPath.localeCompare(b.outputPath));
}

function addIfAvailable(selected: Set<string>, availableFiles: string[], file: string): void {
  if (availableFiles.includes(file)) {
    selected.add(file);
  }
}

function architectureVariantPath(architecture: NormalizedArchitecture): string {
  if (architecture.name === "feature-modules" && typeof architecture.options.boundary === "string") {
    return join("variants", `${architecture.options.boundary}.md`);
  }

  return "guideline.md";
}

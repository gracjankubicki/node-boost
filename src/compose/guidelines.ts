import { join, posix } from "node:path";
import type { DetectedStack, NormalizedArchitecture, ResourceSelection } from "../types.js";
import { listResourceFiles, resourceFileExists } from "./resources.js";

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
  if (stack.name === "astro" && stack.astro) {
    return composeAstroGuidelines(rootDir, stack, architectures);
  }

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

  const architectureGuidelines = await Promise.all(architectures.map((architecture) => architectureGuideline(
    rootDir,
    stack,
    architecture,
  )));

  return [...packageGuidelines, ...architectureGuidelines].sort((a, b) => a.outputPath.localeCompare(b.outputPath));
}

async function composeAstroGuidelines(
  rootDir: string,
  stack: DetectedStack,
  architectures: NormalizedArchitecture[],
): Promise<ResourceSelection[]> {
  const profile = stack.astro;
  if (!profile) {
    return [];
  }
  const astroRoot = join("resources", "stacks", "astro");
  const availableAstro = await listResourceFiles(rootDir, "guidelines", astroRoot);
  const selected = new Set<string>(["core.md", "astro/core.md"]);
  if (profile.major !== null) {
    addIfAvailable(selected, availableAstro, `astro/${profile.major}.md`);
  }
  addIfAvailable(selected, availableAstro, "routing-rendering.md");
  if (stack.astro?.clientIslands || stack.astro?.serverIslands) {
    addIfAvailable(selected, availableAstro, "islands.md");
  }
  if (stack.astro?.contentCollections !== "none") {
    addIfAvailable(selected, availableAstro, "content-collections.md");
  }
  if (stack.astro && (stack.astro.actions || stack.astro.middleware || stack.astro.sessions || stack.astro.routeCache || stack.astro.endpoints)) {
    addIfAvailable(selected, availableAstro, "server-runtime.md");
  }
  if ((stack.astro?.testTools.length ?? 0) > 0) {
    addIfAvailable(selected, availableAstro, "testing.md");
  }
  if (stack.astro?.htmlInjection) {
    addIfAvailable(selected, availableAstro, "safe-html.md");
  }

  const astroGuidelines = [...selected].sort((a, b) => a.localeCompare(b)).map((file) => ({
    kind: "guideline",
    sourcePath: join(astroRoot, "guidelines", file),
    outputPath: posix.join(".ai", "guidelines", "astro", file),
  }) satisfies ResourceSelection);
  const sharedGuidelines = await composeAstroSharedPackageGuidelines(rootDir, stack);
  const frameworkGuidelines = (stack.astro?.uiIntegrations ?? []).map((framework) => ({
    kind: "guideline",
    sourcePath: join("resources", "frameworks", framework, "guidelines", "core.md"),
    outputPath: posix.join(".ai", "guidelines", "frameworks", framework, "core.md"),
  }) satisfies ResourceSelection);
  const architectureGuidelines = await Promise.all(architectures.map((architecture) => architectureGuideline(
    rootDir,
    stack,
    architecture,
  )));

  return [...astroGuidelines, ...sharedGuidelines, ...frameworkGuidelines, ...architectureGuidelines]
    .sort((a, b) => a.outputPath.localeCompare(b.outputPath));
}

async function composeAstroSharedPackageGuidelines(
  rootDir: string,
  stack: DetectedStack,
): Promise<ResourceSelection[]> {
  const availableFiles = await listResourceFiles(rootDir, "guidelines");
  const selected = new Set<string>();
  for (const [packageName, resourceName] of Object.entries(packageResourceMap)) {
    if (["react", "next", "vite", "react-router", "react-router-dom"].includes(packageName)) {
      continue;
    }
    const packageInfo = stack.packages[packageName];
    if (!packageInfo?.version) {
      continue;
    }
    addIfAvailable(selected, availableFiles, `${resourceName}/core.md`);
    if (packageInfo.major !== null) {
      addIfAvailable(selected, availableFiles, `${resourceName}/${packageInfo.major}.md`);
    }
  }
  for (const tool of ["vitest", "jest", "playwright", "msw"] as const) {
    if (stack.packages[tool]?.version) {
      addIfAvailable(selected, availableFiles, `testing/${tool}.md`);
    }
  }
  return [...selected].sort((a, b) => a.localeCompare(b)).map((file) => ({
    kind: "guideline",
    sourcePath: join("resources", "react", "guidelines", file),
    outputPath: posix.join(".ai", "guidelines", file),
  }) satisfies ResourceSelection);
}

async function architectureGuideline(
  rootDir: string,
  stack: DetectedStack,
  architecture: NormalizedArchitecture,
): Promise<ResourceSelection> {
  const variantPath = architectureVariantPath(stack, architecture);
  const astroPath = join("resources", "stacks", "astro", "architectures", architecture.name, variantPath);
  const sourcePath = stack.name === "astro" && await resourceFileExists(rootDir, astroPath)
    ? astroPath
    : join("resources", "react", "architectures", architecture.name, variantPath);
  return {
    kind: "guideline",
    sourcePath,
    outputPath: posix.join(".ai", "guidelines", "architectures", `${architecture.name}.md`),
  };
}

function addIfAvailable(selected: Set<string>, availableFiles: string[], file: string): void {
  if (availableFiles.includes(file)) {
    selected.add(file);
  }
}

function architectureVariantPath(stack: DetectedStack, architecture: NormalizedArchitecture): string {
  if (architecture.name === "feature-modules" && typeof architecture.options.boundary === "string") {
    return join("variants", `${architecture.options.boundary}.md`);
  }

  if (architecture.name === "rendering-strategy") {
    const variant = typeof architecture.options.variant === "string"
      ? architecture.options.variant
      : stack.astro?.rendering;
    if (variant) {
      return join("variants", `${variant}.md`);
    }
  }

  return "guideline.md";
}

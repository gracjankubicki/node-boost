import type { ArchitectureSlug } from "../types.js";

export const commonArchitectures = [
  "feature-modules",
  "data-access-layer",
  "typed-contracts",
  "state-management",
  "custom-hooks",
  "component-composition",
  "testing-strategy",
  "secure-by-default",
  "modern-typescript",
  "ui-states",
] satisfies ArchitectureSlug[];

export const nextOnlyArchitectures = [
  "server-first-components",
  "error-loading-boundaries",
] satisfies ArchitectureSlug[];

export const tailwindArchitecture = "styling-tailwind" satisfies ArchitectureSlug;

export function inferredCommonArchitectures(stack: {
  packages: Record<string, { version: string | null } | undefined>;
}): ArchitectureSlug[] {
  const has = (packageName: string): boolean => Boolean(stack.packages[packageName]?.version);
  const architectures: ArchitectureSlug[] = ["secure-by-default"];

  if (has("typescript")) {
    architectures.push("modern-typescript");
  }

  if (has("zod") || has("valibot")) {
    architectures.push("typed-contracts");
  }

  if (has("@tanstack/react-query") || has("react-query-kit") || has("swr") || has("zustand") || has("nuqs")) {
    architectures.push("state-management");
  }

  if (has("vitest") || has("jest") || has("playwright") || has("storybook") || has("@storybook/react")) {
    architectures.push("testing-strategy");
  }

  return architectures;
}

export function sortArchitectures(architectures: ArchitectureSlug[]): ArchitectureSlug[] {
  return [...architectures].sort((a, b) => a.localeCompare(b));
}

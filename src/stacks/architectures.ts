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

export function sortArchitectures(architectures: ArchitectureSlug[]): ArchitectureSlug[] {
  return [...architectures].sort((a, b) => a.localeCompare(b));
}

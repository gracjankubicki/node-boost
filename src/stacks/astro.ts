import type { ArchitectureSlug, DetectedStack, StackAdapter } from "../types.js";
import { hasPackage } from "./adapter.js";
import { inferredCommonArchitectures, sortArchitectures, tailwindArchitecture } from "./architectures.js";

const astroArchitectures = [
  "feature-modules",
  "typed-contracts",
  "component-composition",
  "testing-strategy",
  "secure-by-default",
  "modern-typescript",
  "islands-architecture",
  "rendering-strategy",
  "content-modeling",
  "request-boundaries",
  "multi-framework-boundaries",
] satisfies ArchitectureSlug[];

export const astroStackAdapter: StackAdapter = {
  name: "astro",
  label: "Astro",
  supports(stack: DetectedStack): boolean {
    return stack.name === "astro";
  },
  applicableArchitectures(stack: DetectedStack): ArchitectureSlug[] {
    const architectures: ArchitectureSlug[] = [...astroArchitectures];
    if (hasPackage(stack, "tailwindcss")) {
      architectures.push(tailwindArchitecture);
    }
    return sortArchitectures(architectures);
  },
  recommendedArchitectures(stack: DetectedStack): ArchitectureSlug[] {
    const architectures = inferredCommonArchitectures(stack);
    const profile = stack.astro;

    architectures.push("rendering-strategy", "secure-by-default", "testing-strategy");
    if (profile?.clientIslands || profile?.serverIslands) {
      architectures.push("islands-architecture");
    }
    if (profile?.contentCollections !== "none" || hasPackage(stack, "@astrojs/db")) {
      architectures.push("content-modeling");
    }
    if (profile && (profile.actions || profile.middleware || profile.endpoints || profile.sessions || profile.routeCache)) {
      architectures.push("request-boundaries");
    }
    if ((profile?.uiIntegrations.length ?? 0) > 1) {
      architectures.push("multi-framework-boundaries");
    }
    if (hasPackage(stack, "tailwindcss")) {
      architectures.push(tailwindArchitecture);
    }

    return sortArchitectures([...new Set(architectures)]);
  },
};

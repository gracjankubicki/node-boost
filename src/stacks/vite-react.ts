import type { ArchitectureSlug, DetectedStack, StackAdapter } from "../types.js";
import { hasPackage } from "./adapter.js";
import { commonArchitectures, inferredCommonArchitectures, sortArchitectures, tailwindArchitecture } from "./architectures.js";

export const viteReactStackAdapter: StackAdapter = {
  name: "vite-react",
  label: "Vite React",
  supports(stack: DetectedStack): boolean {
    return stack.name === "vite-react";
  },
  applicableArchitectures(stack: DetectedStack): ArchitectureSlug[] {
    const architectures: ArchitectureSlug[] = [...commonArchitectures];

    if (hasPackage(stack, "tailwindcss")) {
      architectures.push(tailwindArchitecture);
    }

    return sortArchitectures(architectures);
  },
  recommendedArchitectures(stack: DetectedStack): ArchitectureSlug[] {
    const architectures = inferredCommonArchitectures(stack);

    if (hasPackage(stack, "@tanstack/react-query") || hasPackage(stack, "react-query-kit") || hasPackage(stack, "swr")) {
      architectures.push("data-access-layer");
    }

    if (hasPackage(stack, "tailwindcss")) {
      architectures.push(tailwindArchitecture);
    }

    return sortArchitectures([...new Set(architectures)]);
  },
};

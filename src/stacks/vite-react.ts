import type { ArchitectureSlug, DetectedStack, StackAdapter } from "../types.js";
import { hasPackage } from "./adapter.js";
import { commonArchitectures, sortArchitectures, tailwindArchitecture } from "./architectures.js";

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
    return this.applicableArchitectures(stack);
  },
};

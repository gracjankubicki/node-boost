import type { ArchitectureSlug, DetectedStack, StackAdapter } from "../types.js";
import { hasPackage } from "./adapter.js";
import { commonArchitectures, nextOnlyArchitectures, sortArchitectures, tailwindArchitecture } from "./architectures.js";

export const nextStackAdapter: StackAdapter = {
  name: "next",
  label: "Next.js",
  supports(stack: DetectedStack): boolean {
    return stack.name === "next";
  },
  applicableArchitectures(stack: DetectedStack): ArchitectureSlug[] {
    const architectures: ArchitectureSlug[] = [...commonArchitectures, ...nextOnlyArchitectures];

    if (hasPackage(stack, "tailwindcss")) {
      architectures.push(tailwindArchitecture);
    }

    return sortArchitectures(architectures);
  },
  recommendedArchitectures(stack: DetectedStack): ArchitectureSlug[] {
    return this.applicableArchitectures(stack);
  },
};

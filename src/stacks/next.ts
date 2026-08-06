import type { ArchitectureSlug, DetectedStack, StackAdapter } from "../types.js";
import { hasPackage } from "./adapter.js";
import {
  commonArchitectures,
  inferredCommonArchitectures,
  nextOnlyArchitectures,
  sortArchitectures,
  tailwindArchitecture,
} from "./architectures.js";

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
    const architectures = inferredCommonArchitectures(stack);

    if (stack.router === "app") {
      architectures.push("server-first-components", "error-loading-boundaries", "data-access-layer");
    }

    if (hasPackage(stack, "tailwindcss")) {
      architectures.push(tailwindArchitecture);
    }

    return sortArchitectures([...new Set(architectures)]);
  },
};

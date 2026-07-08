import { dirname } from "node:path";
import type { AuditRule } from "../rule.js";
import { finding } from "./helpers.js";

export const errorLoadingBoundaryRules: AuditRule[] = [
  {
    id: "NB-ARCH-010",
    code: "segment-without-boundaries",
    architecture: "error-loading-boundaries",
    defaultSeverity: "warn",
    stacks: ["next"],
    kind: "project",
    check(context) {
      return context.files.flatMap((file) => {
        if (!/(^|\/)app\/.+\/page\.tsx?$/.test(file.path) || !/\b(async|await)\b/.test(file.content)) {
          return [];
        }

        return hasBoundaryInBranch(file.path, context.allPaths)
          ? []
          : [finding(file, "NB-ARCH-010", "segment-without-boundaries", 1)];
      });
    },
  },
];

function hasBoundaryInBranch(pagePath: string, allPaths: Set<string>): boolean {
  let current = dirname(pagePath);

  while (current.includes("/app/") || current.endsWith("/app") || current === "app" || current === "src/app") {
    for (const name of ["loading.tsx", "loading.ts", "loading.jsx", "loading.js", "error.tsx", "error.ts", "error.jsx", "error.js"]) {
      if (allPaths.has(`${current}/${name}`)) {
        return true;
      }
    }

    if (current.endsWith("/app") || current === "app" || current === "src/app") {
      break;
    }

    current = dirname(current);
  }

  return false;
}

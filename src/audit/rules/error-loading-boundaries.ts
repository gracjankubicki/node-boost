import { dirname } from "node:path";
import { SyntaxKind } from "ts-morph";
import type { AuditFile, AuditRule } from "../rule.js";
import { finding, isNextEntryPath } from "./helpers.js";

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
        if (!isNextEntryPath(file.path, "page") || !isAsyncPage(file)) {
          return [];
        }

        return hasBoundaryInBranch(file.path, context.allPaths)
          ? []
          : [finding(file, "NB-ARCH-010", "segment-without-boundaries", 1)];
      });
    },
  },
];

function isAsyncPage(file: AuditFile): boolean {
  if (!file.sourceFile) {
    return false;
  }

  if (file.sourceFile.getDescendantsOfKind(SyntaxKind.AwaitExpression).length > 0) {
    return true;
  }

  return file.sourceFile.getFunctions().some((declaration) => declaration.isAsync())
    || file.sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction).some((declaration) => declaration.isAsync())
    || file.sourceFile.getDescendantsOfKind(SyntaxKind.FunctionExpression).some((declaration) => declaration.isAsync());
}

function hasBoundaryInBranch(pagePath: string, allPaths: Set<string>): boolean {
  let current = dirname(pagePath);

  while (isAppDirectory(current)) {
    for (const name of ["loading.tsx", "loading.ts", "loading.jsx", "loading.js", "error.tsx", "error.ts", "error.jsx", "error.js"]) {
      if (allPaths.has(`${current}/${name}`)) {
        return true;
      }
    }

    if (current === "app" || current === "src/app") {
      break;
    }
    current = dirname(current);
  }

  return false;
}

function isAppDirectory(path: string): boolean {
  return path === "app" || path === "src/app" || path.startsWith("app/") || path.startsWith("src/app/");
}

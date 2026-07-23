import { dirname } from "node:path";
import { Node, SyntaxKind, type Expression } from "ts-morph";
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
        if (!isNextEntryPath(file.path, "page") || !hasSuspendingCall(file)) {
          return [];
        }

        return hasBoundaryInBranch(file.path, context.allPaths)
          ? []
          : [finding(file, "NB-ARCH-010", "segment-without-boundaries", 1)];
      });
    },
  },
];

function hasSuspendingCall(file: AuditFile): boolean {
  if (!file.sourceFile) {
    return false;
  }

  return file.sourceFile.getDescendantsOfKind(SyntaxKind.AwaitExpression).some((awaitExpression) =>
    Node.isCallExpression(unwrapExpression(awaitExpression.getExpression())),
  );
}

function unwrapExpression(expression: Expression): Expression {
  let current = expression;
  while (
    Node.isParenthesizedExpression(current)
    || Node.isAsExpression(current)
    || Node.isTypeAssertion(current)
    || Node.isNonNullExpression(current)
    || Node.isSatisfiesExpression(current)
  ) {
    current = current.getExpression();
  }
  return current;
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

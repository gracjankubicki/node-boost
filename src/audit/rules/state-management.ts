import { SyntaxKind } from "ts-morph";
import type { AuditRule } from "../rule.js";
import { callTarget, dataLayerGlobs, finding, isDataLayerFile } from "./helpers.js";

const serverMethods = new Set(["fetch", "get", "list", "load", "post"]);

export const stateManagementRules: AuditRule[] = [
  {
    id: "NB-ARCH-009",
    code: "server-state-in-store",
    architecture: "state-management",
    defaultSeverity: "warn",
    stacks: ["next", "vite-react"],
    kind: "ast",
    check(context) {
      const globs = dataLayerGlobs(context.ruleOptions);
      return context.files.flatMap((file) => {
        if (isDataLayerFile(file, globs) || !file.sourceFile) {
          return [];
        }

        const hasServerRead = file.sourceFile.getDescendantsOfKind(SyntaxKind.AwaitExpression).some((awaitExpression) =>
          awaitExpression.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => isServerRead(callTarget(call.getExpression())))
          || (awaitExpression.getExpression().getKind() === SyntaxKind.CallExpression
            && isServerRead(callTarget(awaitExpression.getExpression().asKindOrThrow(SyntaxKind.CallExpression).getExpression()))),
        );
        if (!hasServerRead) {
          return [];
        }

        return file.sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).flatMap((call) =>
          isStoreWrite(callTarget(call.getExpression()))
            ? [finding(file, "NB-ARCH-009", "server-state-in-store", call.getStartLineNumber())]
            : [],
        );
      });
    },
  },
];

function isServerRead(target: string | undefined): boolean {
  const method = target?.split(".").at(-1);
  return method !== undefined && serverMethods.has(method);
}

function isStoreWrite(target: string | undefined): boolean {
  if (target === "dispatch" || target === "set") {
    return true;
  }

  const parts = target?.split(".") ?? [];
  const store = parts.at(-2) ?? "";
  return parts.at(-1) === "setState"
    && store.startsWith("use")
    && store.endsWith("Store")
    && isUppercaseLetter(store[3]);
}

function isUppercaseLetter(character: string | undefined): boolean {
  return character !== undefined && character >= "A" && character <= "Z";
}

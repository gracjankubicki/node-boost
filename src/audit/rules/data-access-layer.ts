import { basename } from "node:path";
import { SyntaxKind } from "ts-morph";
import type { AuditFile, AuditRule } from "../rule.js";
import { callTarget, dataLayerGlobs, finding, isClientComponent, isDataLayerFile } from "./helpers.js";

export const dataAccessLayerRules: AuditRule[] = [
  {
    id: "NB-ARCH-005",
    code: "fetch-in-client-component",
    architecture: "data-access-layer",
    defaultSeverity: "err",
    stacks: ["next", "vite-react"],
    kind: "ast",
    check(context) {
      const globs = dataLayerGlobs(context.ruleOptions);
      return context.files.flatMap((file) => {
        if (!isClientComponent(file, context.stack.name) || isDataLayerFile(file, globs) || isQueryHook(file)) {
          return [];
        }

        return networkFindings(file, "NB-ARCH-005", "fetch-in-client-component");
      });
    },
  },
  {
    id: "NB-ARCH-006",
    code: "raw-fetch-in-rsc",
    architecture: "data-access-layer",
    defaultSeverity: "warn",
    stacks: ["next"],
    kind: "ast",
    check(context) {
      const globs = dataLayerGlobs(context.ruleOptions);
      return context.files.flatMap((file) => {
        if (isClientComponent(file, context.stack.name) || isDataLayerFile(file, globs)) {
          return [];
        }

        return networkFindings(file, "NB-ARCH-006", "raw-fetch-in-rsc");
      });
    },
  },
];

function networkFindings(file: AuditFile, rule: string, code: string) {
  if (!file.sourceFile) {
    return [];
  }

  return file.sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).flatMap((call) =>
    isNetworkTarget(callTarget(call.getExpression()))
      ? [finding(file, rule, code, call.getStartLineNumber())]
      : [],
  );
}

function isNetworkTarget(target: string | undefined): boolean {
  return target === "fetch"
    || target === "ky"
    || target?.startsWith("axios.") === true
    || target?.startsWith("ky.") === true;
}

function isQueryHook(file: AuditFile): boolean {
  if (!file.sourceFile) {
    return false;
  }

  const name = basename(file.path).split(".")[0] ?? "";
  const hookFile = name.startsWith("use") && isUppercaseLetter(name[3]);
  return hookFile && file.sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    const target = callTarget(call.getExpression());
    const called = target?.split(".").at(-1);
    return called === "useQuery" || called === "useMutation";
  });
}

function isUppercaseLetter(character: string | undefined): boolean {
  return character !== undefined && character >= "A" && character <= "Z";
}

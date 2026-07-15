import { SyntaxKind } from "ts-morph";
import type { AuditFile, AuditRule } from "../rule.js";
import {
  callTarget,
  dataLayerGlobs,
  environmentAccesses,
  finding,
  hasGeneratedClientDependency,
  isConfigFile,
  isDataLayerFile,
} from "./helpers.js";

export const typedContractRules: AuditRule[] = [
  {
    id: "NB-ARCH-007",
    code: "unvalidated-boundary",
    architecture: "typed-contracts",
    defaultSeverity: "warn",
    stacks: ["next", "vite-react"],
    kind: "ast",
    check(context) {
      if (hasGeneratedClientDependency(context.rootDir)) {
        return [];
      }

      const globs = dataLayerGlobs(context.ruleOptions);
      return context.files.flatMap((file) => {
        if (!isDataLayerFile(file, globs) || hasSchemaParser(file) || !file.sourceFile) {
          return [];
        }

        return file.sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).flatMap((call) =>
          isUnvalidatedBoundaryCall(callTarget(call.getExpression()), call.getFirstAncestorByKind(SyntaxKind.AwaitExpression) !== undefined)
            ? [finding(file, "NB-ARCH-007", "unvalidated-boundary", call.getStartLineNumber())]
            : [],
        );
      });
    },
  },
  {
    id: "NB-ARCH-008",
    code: "env-outside-env-file",
    architecture: "typed-contracts",
    defaultSeverity: "warn",
    stacks: ["next", "vite-react"],
    kind: "ast",
    check(context) {
      const envFiles = envFileGlobs(context.ruleOptions);
      return context.files.flatMap((file) => {
        if (isConfigFile(file.path) || envFiles.some((envFile) => file.path.endsWith(envFile))) {
          return [];
        }

        return environmentAccesses(file)
          .filter((access) => access.name !== "NODE_ENV")
          .map((access) => finding(file, "NB-ARCH-008", "env-outside-env-file", access.line, access.name));
      });
    },
  },
];

function hasSchemaParser(file: AuditFile): boolean {
  return file.sourceFile?.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    const method = callTarget(call.getExpression())?.split(".").at(-1);
    return method === "parse" || method === "safeParse";
  }) ?? false;
}

function isUnvalidatedBoundaryCall(target: string | undefined, awaited: boolean): boolean {
  return target === "JSON.parse" || (awaited && target?.split(".").at(-1) === "json");
}

function envFileGlobs(options: Record<string, unknown>): string[] {
  const configured = options.envFiles;
  return Array.isArray(configured) && configured.every((item) => typeof item === "string") ? configured : ["env.ts", "env.mjs"];
}

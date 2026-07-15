import { readTypeScriptConfig } from "../../config/typescript-config.js";
import { SyntaxKind } from "ts-morph";
import type { AuditRule } from "../rule.js";
import { finding, isTestFile } from "./helpers.js";

export const modernTypeScriptRules: AuditRule[] = [
  {
    id: "NB-ARCH-013",
    code: "tsconfig-not-strict",
    architecture: "modern-typescript",
    defaultSeverity: "warn",
    stacks: ["next", "vite-react"],
    kind: "project",
    check(context) {
      return readTypeScriptConfig(context.rootDir).strict === true ? [] : [{
        rule: "NB-ARCH-013",
        sev: "warn",
        file: "tsconfig.json",
        line: 1,
        code: "tsconfig-not-strict",
      }];
    },
  },
  {
    id: "NB-ARCH-014",
    code: "explicit-any",
    architecture: "modern-typescript",
    defaultSeverity: "warn",
    stacks: ["next", "vite-react"],
    kind: "ast",
    check(context) {
      return context.files.flatMap((file) => {
        if (isTestFile(file.path) || !file.sourceFile) {
          return [];
        }

        const lines = new Set(file.sourceFile.getDescendantsOfKind(SyntaxKind.AnyKeyword).map((node) => node.getStartLineNumber()));
        return [...lines].map((line) => finding(file, "NB-ARCH-014", "explicit-any", line));
      });
    },
  },
];

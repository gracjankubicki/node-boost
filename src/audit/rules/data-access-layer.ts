import type { AuditRule } from "../rule.js";
import { dataLayerGlobs, finding, isClientComponent, isDataLayerFile } from "./helpers.js";

const networkPattern = /\b(fetch\s*\(|axios\.|ky\s*\(|ky\.)/;

export const dataAccessLayerRules: AuditRule[] = [
  {
    id: "NB-ARCH-005",
    code: "fetch-in-client-component",
    architecture: "data-access-layer",
    defaultSeverity: "err",
    stacks: ["next", "vite-react"],
    kind: "line",
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
    kind: "line",
    check(context) {
      const globs = dataLayerGlobs(context.ruleOptions);
      return context.files.flatMap((file) => {
        if (isClientComponent(file, context.stack.name) || isDataLayerFile(file, globs)) {
          return [];
        }

        return networkFindings(file, "NB-ARCH-006", "raw-fetch-in-rsc").filter((item) => item.code === "raw-fetch-in-rsc");
      });
    },
  },
];

function networkFindings(file: Parameters<typeof finding>[0], rule: string, code: string) {
  return file.lines.flatMap((line, index) => (networkPattern.test(line) ? [finding(file, rule, code, index + 1)] : []));
}

function isQueryHook(file: Parameters<typeof finding>[0]): boolean {
  return /(^|\/)use[A-Z][^/]*\.tsx?$/.test(file.path) && /\buse(Query|Mutation)\s*\(/.test(file.content);
}

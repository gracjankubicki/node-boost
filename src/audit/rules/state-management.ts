import type { AuditRule } from "../rule.js";
import { dataLayerGlobs, finding, isDataLayerFile } from "./helpers.js";

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
        if (isDataLayerFile(file, globs)) {
          return [];
        }

        const hasServerRead = /\bawait\s+(?:fetch\s*\(|\w+\.(?:get|post|list|fetch|load)\s*\()/.test(file.content);
        if (!hasServerRead) {
          return [];
        }

        return file.lines.flatMap((line, index) =>
          /\b(use[A-Z]\w*Store\.setState|dispatch|set)\s*\(/.test(line)
            ? [finding(file, "NB-ARCH-009", "server-state-in-store", index + 1)]
            : [],
        );
      });
    },
  },
];

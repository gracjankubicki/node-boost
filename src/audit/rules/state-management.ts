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

        const looksLikeStoreModule = /(^|\/)(?:stores?|state)(\/|\.)/.test(file.path) || /\bcreate(?:Store)?\s*\(/.test(file.content);
        const usesStoreDispatch = /\buseDispatch\s*\(/.test(file.content);

        return file.lines.flatMap((line, index) =>
          /\buse[A-Z]\w*Store\.setState\s*\(/.test(line) ||
          (looksLikeStoreModule && /\bset\s*\(/.test(line)) ||
          (usesStoreDispatch && /\bdispatch\s*\(/.test(line))
            ? [finding(file, "NB-ARCH-009", "server-state-in-store", index + 1)]
            : [],
        );
      });
    },
  },
];

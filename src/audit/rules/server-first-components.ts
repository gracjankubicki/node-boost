import type { AuditRule } from "../rule.js";
import { finding, hasUseClientDirective, lineOf } from "./helpers.js";

export const serverFirstComponentRules: AuditRule[] = [
  {
    id: "NB-ARCH-003",
    code: "use-client-in-entry",
    architecture: "server-first-components",
    defaultSeverity: "err",
    stacks: ["next"],
    kind: "line",
    check(context) {
      return context.files.flatMap((file) => {
        if (!hasUseClientDirective(file) || !/(^|\/)(page|layout)\.tsx?$/.test(file.path)) {
          return [];
        }

        return [finding(file, "NB-ARCH-003", "use-client-in-entry", lineOf(file.content, /['"]use client['"]/))];
      });
    },
  },
  {
    id: "NB-ARCH-004",
    code: "needless-use-client",
    architecture: "server-first-components",
    defaultSeverity: "warn",
    stacks: ["next"],
    kind: "line",
    check(context) {
      return context.files.flatMap((file) => {
        if (!hasUseClientDirective(file)) {
          return [];
        }

        const withoutDirective = file.lines.filter((line) => !line.includes("use client")).join("\n");
        const needsClient =
          /\buse[A-Z]\w*\s*\(/.test(withoutDirective) ||
          /\bon[A-Z]\w*\s*=/.test(withoutDirective) ||
          /\b(window|document|navigator|localStorage|sessionStorage)\b/.test(withoutDirective) ||
          /\b(?:Resize|Intersection|Mutation)Observer\b/.test(withoutDirective);
        return needsClient ? [] : [finding(file, "NB-ARCH-004", "needless-use-client", lineOf(file.content, /['"]use client['"]/))];
      });
    },
  },
];

import type { AuditRule } from "../rule.js";
import { finding } from "./helpers.js";

export const secureByDefaultRules: AuditRule[] = [
  {
    id: "NB-ARCH-011",
    code: "unsanitized-html",
    architecture: "secure-by-default",
    defaultSeverity: "err",
    stacks: ["next", "vite-react"],
    kind: "line",
    check(context) {
      return context.files.flatMap((file) =>
        file.lines.flatMap((line, index) => {
          const match = line.match(/dangerouslySetInnerHTML=\{\{\s*__html:\s*([^}]+)\s*\}\}/);
          if (!match) {
            return [];
          }

          const value = match[1]?.trim() ?? "";
          const safe = /sanitize\s*\(/i.test(value) || /^["'`]/.test(value);
          return safe ? [] : [finding(file, "NB-ARCH-011", "unsanitized-html", index + 1)];
        }),
      );
    },
  },
  {
    id: "NB-ARCH-012",
    code: "public-env-secret-name",
    architecture: "secure-by-default",
    defaultSeverity: "warn",
    stacks: ["next", "vite-react"],
    kind: "line",
    check(context) {
      return context.files.flatMap((file) =>
        file.lines.flatMap((line, index) => {
          const names = [...line.matchAll(/\b((?:NEXT_PUBLIC|VITE)_[A-Z0-9_]+)/g)].map((match) => match[1] ?? "");
          return names
            .filter((name) => /(SECRET|TOKEN|PRIVATE|PASSWORD|_KEY$)/.test(name))
            .map((name) => finding(file, "NB-ARCH-012", "public-env-secret-name", index + 1, name));
        }),
      );
    },
  },
];

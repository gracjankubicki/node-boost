import type { AuditRule } from "../rule.js";
import { dataLayerGlobs, finding, hasGeneratedClientDependency, isConfigFile, isDataLayerFile } from "./helpers.js";

export const typedContractRules: AuditRule[] = [
  {
    id: "NB-ARCH-007",
    code: "unvalidated-boundary",
    architecture: "typed-contracts",
    defaultSeverity: "warn",
    stacks: ["next", "vite-react"],
    kind: "line",
    check(context) {
      if (hasGeneratedClientDependency(context.rootDir)) {
        return [];
      }

      const globs = dataLayerGlobs(context.ruleOptions);
      return context.files.flatMap((file) => {
        if (!isDataLayerFile(file, globs) || /\.s(afe)?parse\s*\(/.test(file.content)) {
          return [];
        }

        return file.lines.flatMap((line, index) =>
          /(=\s*await\s+\w+\.json\s*\(|=\s*JSON\.parse\s*\(|as\s+\w+.*await\s+\w+\.json\s*\()/.test(line)
            ? [finding(file, "NB-ARCH-007", "unvalidated-boundary", index + 1)]
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
    kind: "line",
    check(context) {
      const envFiles = envFileGlobs(context.ruleOptions);
      return context.files.flatMap((file) => {
        if (isConfigFile(file.path) || envFiles.some((envFile) => file.path.endsWith(envFile))) {
          return [];
        }

        return file.lines.flatMap((line, index) => {
          const names = [...line.matchAll(/(?:process\.env|import\.meta\.env)\.([A-Z0-9_]+)/g)].map((match) => match[1] ?? "");
          return names.filter((name) => name !== "NODE_ENV").map((name) => finding(file, "NB-ARCH-008", "env-outside-env-file", index + 1, name));
        });
      });
    },
  },
];

function envFileGlobs(options: Record<string, unknown>): string[] {
  const configured = options.envFiles;
  return Array.isArray(configured) && configured.every((item) => typeof item === "string") ? configured : ["env.ts", "env.mjs"];
}

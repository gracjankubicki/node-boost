import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { AuditRule } from "../rule.js";
import { finding } from "./helpers.js";

export const modernTypeScriptRules: AuditRule[] = [
  {
    id: "NB-ARCH-013",
    code: "tsconfig-not-strict",
    architecture: "modern-typescript",
    defaultSeverity: "warn",
    stacks: ["next", "vite-react"],
    kind: "project",
    check(context) {
      return tsconfigStrict(context.rootDir) ? [] : [{
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
    kind: "line",
    check(context) {
      return context.files.flatMap((file) => {
        if (/(\.d\.ts|\.test\.[jt]sx?|\.spec\.[jt]sx?)$/.test(file.path) || file.path.startsWith("tests/")) {
          return [];
        }

        return file.lines.flatMap((line, index) =>
          /(:\s*any\b|as\s+any\b|<any>)/.test(line) ? [finding(file, "NB-ARCH-014", "explicit-any", index + 1)] : [],
        );
      });
    },
  },
];

function tsconfigStrict(rootDir: string): boolean {
  const visited = new Set<string>();
  return readStrictFromTsconfig(join(rootDir, "tsconfig.json"), visited) === true;
}

function readStrictFromTsconfig(path: string, visited: Set<string>): boolean | null {
  if (visited.has(path) || !existsSync(path)) {
    return null;
  }

  visited.add(path);

  const parsed = JSON.parse(stripJsonComments(readFileSync(path, "utf8"))) as {
    extends?: string;
    compilerOptions?: { strict?: boolean };
  };

  if (parsed.compilerOptions?.strict !== undefined) {
    return parsed.compilerOptions.strict;
  }

  if (!parsed.extends) {
    return null;
  }

  if (parsed.extends.startsWith(".")) {
    return readStrictFromTsconfig(resolve(dirname(path), parsed.extends), visited);
  }

  return null;
}

function stripJsonComments(value: string): string {
  return value.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import picomatch from "picomatch";
import { Node, SyntaxKind, type Expression } from "ts-morph";
import type { AuditFile, AuditFinding } from "../rule.js";

const sourceExtensions = new Set(["js", "jsx", "ts", "tsx", "mjs", "cjs", "mts", "cts"]);

export function useClientDirectiveLine(file: AuditFile): number | null {
  if (!file.sourceFile) {
    return null;
  }

  for (const statement of file.sourceFile.getStatements()) {
    if (!Node.isExpressionStatement(statement)) {
      return null;
    }
    const expression = statement.getExpression();
    if (!Node.isStringLiteral(expression)) {
      return null;
    }
    if (expression.getLiteralValue() === "use client") {
      return statement.getStartLineNumber();
    }
  }

  return null;
}

export function hasUseClientDirective(file: AuditFile): boolean {
  return useClientDirectiveLine(file) !== null;
}

export function isClientComponent(file: AuditFile, stackName: string): boolean {
  if (stackName !== "vite-react") {
    return hasUseClientDirective(file);
  }

  if (!file.sourceFile) {
    return false;
  }

  return file.sourceFile.getDescendantsOfKind(SyntaxKind.JsxElement).length > 0
    || file.sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement).length > 0
    || file.sourceFile.getDescendantsOfKind(SyntaxKind.JsxFragment).length > 0;
}

export function isDataLayerFile(file: AuditFile, globs: string[]): boolean {
  const parts = basename(file.path).split(".");
  if (parts[0] === "route" && parts.length === 2 && sourceExtensions.has(parts[1] ?? "")) {
    return true;
  }

  return picomatch(globs)(file.path);
}

export function dataLayerGlobs(options: Record<string, unknown>): string[] {
  const configured = options.dataLayerGlobs;
  return Array.isArray(configured) && configured.every((item) => typeof item === "string")
    ? configured
    : [
      "**/api/**",
      "**/server/**",
      "**/*-api/**",
      "**/api.{js,jsx,ts,tsx,mjs,cjs,mts,cts}",
      "**/*.api.{js,jsx,ts,tsx,mjs,cjs,mts,cts}",
      "lib/api/**",
      "src/lib/api/**",
    ];
}

export function finding(file: AuditFile, rule: string, code: string, line: number, ref?: string): AuditFinding {
  return {
    rule,
    sev: "warn",
    file: file.path,
    line,
    code,
    ref,
  };
}

export function isConfigFile(path: string): boolean {
  const parts = basename(path).split(".");
  const extension = parts.at(-1) ?? "";
  return parts.length >= 3 && parts.at(-2) === "config" && sourceExtensions.has(extension);
}

export function isTestFile(path: string): boolean {
  if (path.startsWith("tests/") || path.endsWith(".d.ts")) {
    return true;
  }

  const parts = basename(path).split(".");
  const extension = parts.at(-1) ?? "";
  const marker = parts.at(-2);
  return sourceExtensions.has(extension) && (marker === "test" || marker === "spec");
}

export function isNextEntryPath(path: string, entry: "page" | "layout"): boolean {
  const parts = path.split("/");
  const appIndex = parts[0] === "app" ? 0 : parts[0] === "src" && parts[1] === "app" ? 1 : -1;
  if (appIndex === -1 || parts.length <= appIndex + 1) {
    return false;
  }

  const file = parts.at(-1)?.split(".") ?? [];
  return file.length === 2 && file[0] === entry && sourceExtensions.has(file[1] ?? "");
}

export function callTarget(expression: Expression): string | undefined {
  const current = unwrapExpression(expression);
  if (Node.isIdentifier(current)) {
    return current.getText();
  }
  if (Node.isPropertyAccessExpression(current)) {
    const owner = callTarget(current.getExpression());
    return owner ? `${owner}.${current.getName()}` : undefined;
  }
  return undefined;
}

export function environmentAccesses(file: AuditFile): Array<{ name: string; line: number; public: boolean }> {
  if (!file.sourceFile) {
    return [];
  }

  return file.sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).flatMap((access) => {
    const environment = access.getExpression();
    if (!Node.isPropertyAccessExpression(environment) || environment.getName() !== "env") {
      return [];
    }

    const owner = environment.getExpression();
    const processEnv = Node.isIdentifier(owner) && owner.getText() === "process";
    const importMetaEnv = Node.isMetaProperty(owner) && owner.getText() === "import.meta";
    if (!processEnv && !importMetaEnv) {
      return [];
    }

    const name = access.getName();
    return [{
      name,
      line: access.getStartLineNumber(),
      public: name.startsWith("NEXT_PUBLIC_") || name.startsWith("VITE_"),
    }];
  });
}

export function splitTextLines(content: string): string[] {
  return content.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
}

export function hasGeneratedClientDependency(rootDir: string): boolean {
  try {
    const packageJson = JSON.parse(existsSync(join(rootDir, "package.json")) ? readFileSync(join(rootDir, "package.json"), "utf8") : "{}") as {
      devDependencies?: Record<string, string>;
    };
    return Boolean(packageJson.devDependencies?.orval || packageJson.devDependencies?.["openapi-typescript"]);
  } catch {
    return false;
  }
}

export function toPosix(path: string): string {
  return path.replaceAll("\\", "/");
}

function unwrapExpression(expression: Expression): Expression {
  let current = expression;
  while (
    Node.isParenthesizedExpression(current)
    || Node.isAsExpression(current)
    || Node.isTypeAssertion(current)
    || Node.isNonNullExpression(current)
    || Node.isSatisfiesExpression(current)
  ) {
    current = current.getExpression();
  }
  return current;
}

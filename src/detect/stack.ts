import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Node, Project, ScriptKind, SyntaxKind, type Expression } from "ts-morph";
import { detectPackageManager } from "./package-manager.js";
import { detectNextRouter } from "./router.js";
import type { DetectedStack, LintingKind, PackageInfo, StackName } from "../types.js";

const trackedPackages = [
  "next",
  "react",
  "vite",
  "react-router",
  "react-router-dom",
  "typescript",
  "tailwindcss",
  "zod",
  "valibot",
  "@tanstack/react-query",
  "react-query-kit",
  "swr",
  "zustand",
  "nuqs",
  "react-hook-form",
  "msw",
  "storybook",
  "@storybook/react",
  "@mantine/core",
  "i18next",
  "react-i18next",
  "@lingui/core",
  "html-react-parser",
  "dompurify",
  "isomorphic-dompurify",
  "sanitize-html",
  "orval",
  "openapi-typescript",
  "babel-plugin-react-compiler",
  "vitest",
  "jest",
  "playwright",
  "eslint",
  "prettier",
  "@biomejs/biome",
] as const;

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  babel?: unknown;
};

const codeConfigFiles = [
  "next.config.js",
  "next.config.mjs",
  "next.config.cjs",
  "next.config.ts",
  "next.config.mts",
  "next.config.cts",
  "vite.config.js",
  "vite.config.mjs",
  "vite.config.cjs",
  "vite.config.ts",
  "vite.config.mts",
  "vite.config.cts",
  "babel.config.js",
  "babel.config.mjs",
  "babel.config.cjs",
  "babel.config.ts",
] as const;

export async function detectStack(rootDir: string): Promise<DetectedStack> {
  const packageJson = await readPackageJson(rootDir);
  const packageManager = await detectPackageManager(rootDir);
  const packages = await detectPackages(rootDir, packageJson);
  const warnings: string[] = [];

  const name = detectStackName(packages);
  const nextRouter = name === "next" ? await detectNextRouter(rootDir) : null;
  const hasReactRouter = Boolean(packages["react-router"]?.version || packages["react-router-dom"]?.version);
  const router = nextRouter?.router ?? (name === "vite-react" && hasReactRouter ? "react-router" : "none");
  const srcDir = nextRouter?.srcDir ?? false;
  const linting = detectLinting(packages);
  const capabilities = await detectCapabilities(rootDir, packageJson);

  if (Object.values(packages).some((pkg) => pkg.source === "range")) {
    warnings.push("node_modules not available for at least one package; using declared version range fallback.");
  }

  return {
    rootDir,
    name,
    router,
    srcDir,
    linting,
    packageManager,
    packages,
    capabilities,
    warnings,
  };
}

async function detectCapabilities(rootDir: string, packageJson: PackageJson): Promise<DetectedStack["capabilities"]> {
  const capabilities: DetectedStack["capabilities"] = {
    reactCompiler: hasBabelCompilerPlugin(packageJson.babel),
    nextCacheComponents: false,
  };
  const project = new Project({
    useInMemoryFileSystem: true,
    skipAddingFilesFromTsConfig: true,
    compilerOptions: { allowJs: true },
  });

  for (const fileName of codeConfigFiles) {
    const content = await readOptional(join(rootDir, fileName));
    if (content === null) {
      continue;
    }

    const sourceFile = project.createSourceFile(fileName, content, {
      overwrite: true,
      scriptKind: scriptKindFor(fileName),
    });

    for (const property of sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
      const name = propertyName(property.getNameNode());
      const initializer = unwrapExpression(property.getInitializer());

      if (name === "reactCompiler" && initializer && (Node.isTrueLiteral(initializer) || Node.isObjectLiteralExpression(initializer))) {
        capabilities.reactCompiler = true;
      }
      if (name === "cacheComponents" && initializer && Node.isTrueLiteral(initializer)) {
        capabilities.nextCacheComponents = true;
      }
      if (name === "plugins" && initializer && Node.isArrayLiteralExpression(initializer) && hasCompilerPluginElement(initializer.getElements())) {
        capabilities.reactCompiler = true;
      }
    }
  }

  for (const fileName of [".babelrc", ".babelrc.json"] as const) {
    const content = await readOptional(join(rootDir, fileName));
    if (content === null) {
      continue;
    }
    try {
      capabilities.reactCompiler ||= hasBabelCompilerPlugin(JSON.parse(content));
    } catch {
      // Invalid Babel config is reported by its own tool; capability detection stays conservative.
    }
  }

  return capabilities;
}

function hasCompilerPluginElement(elements: Node[]): boolean {
  return elements.some((element) => {
    const current = unwrapExpression(Node.isExpression(element) ? element : undefined);
    if (current && Node.isStringLiteral(current)) {
      return current.getLiteralValue() === "babel-plugin-react-compiler";
    }
    if (!current || !Node.isArrayLiteralExpression(current)) {
      return false;
    }
    const [first] = current.getElements();
    return Node.isStringLiteral(first) && first.getLiteralValue() === "babel-plugin-react-compiler";
  });
}

function hasBabelCompilerPlugin(value: unknown): boolean {
  if (!isObject(value) || !Array.isArray(value.plugins)) {
    return false;
  }

  return value.plugins.some((plugin) =>
    plugin === "babel-plugin-react-compiler"
    || (Array.isArray(plugin) && plugin[0] === "babel-plugin-react-compiler"),
  );
}

function propertyName(node: Node): string | null {
  if (Node.isIdentifier(node) || Node.isStringLiteral(node) || Node.isNumericLiteral(node)) {
    return Node.isStringLiteral(node) ? node.getLiteralValue() : node.getText();
  }
  return null;
}

function unwrapExpression(expression: Expression | undefined): Expression | undefined {
  let current = expression;
  while (current && (Node.isParenthesizedExpression(current) || Node.isAsExpression(current) || Node.isSatisfiesExpression(current))) {
    current = current.getExpression();
  }
  return current;
}

function scriptKindFor(fileName: string): ScriptKind {
  return fileName.endsWith(".ts") || fileName.endsWith(".mts") || fileName.endsWith(".cts")
    ? ScriptKind.TS
    : ScriptKind.JS;
}

function detectLinting(packages: Record<string, PackageInfo>): LintingKind {
  if (packages["@biomejs/biome"]?.version) {
    return "biome";
  }

  if (packages.eslint?.version && packages.prettier?.version) {
    return "eslint-prettier";
  }

  if (packages.eslint?.version) {
    return "eslint";
  }

  return "none";
}

async function detectPackages(rootDir: string, packageJson: PackageJson): Promise<Record<string, PackageInfo>> {
  const packages: Record<string, PackageInfo> = {};

  for (const packageName of trackedPackages) {
    const declaredRange = findDeclaredRange(packageJson, packageName);
    const installedVersion = await readInstalledVersion(rootDir, packageName);
    const version = installedVersion ?? extractVersionFromRange(declaredRange);

    packages[packageName] = {
      name: packageName,
      declaredRange,
      version,
      major: version ? parseMajor(version) : null,
      source: installedVersion ? "node_modules" : version ? "range" : "missing",
    };
  }

  return packages;
}

function detectStackName(packages: Record<string, PackageInfo>): StackName {
  if (packages.next?.version) {
    return "next";
  }

  if (packages.react?.version && packages.vite?.version) {
    return "vite-react";
  }

  if (packages.react?.version) {
    return "react-generic";
  }

  return "unknown";
}

async function readPackageJson(rootDir: string): Promise<PackageJson> {
  const raw = await readFile(join(rootDir, "package.json"), "utf8");
  const parsed: unknown = JSON.parse(raw);

  if (!isObject(parsed)) {
    throw new Error("package.json must contain an object.");
  }

  return parsed;
}

function findDeclaredRange(packageJson: PackageJson, packageName: string): string | null {
  return (
    packageJson.dependencies?.[packageName] ??
    packageJson.devDependencies?.[packageName] ??
    packageJson.peerDependencies?.[packageName] ??
    packageJson.optionalDependencies?.[packageName] ??
    null
  );
}

async function readInstalledVersion(rootDir: string, packageName: string): Promise<string | null> {
  try {
    const raw = await readFile(join(rootDir, "node_modules", packageName, "package.json"), "utf8");
    const parsed: unknown = JSON.parse(raw);

    if (isObject(parsed) && typeof parsed.version === "string") {
      return parsed.version;
    }

    return null;
  } catch {
    return null;
  }
}

async function readOptional(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

export function extractVersionFromRange(range: string | null): string | null {
  if (!range) {
    return null;
  }

  const match = range.match(/\d+\.\d+\.\d+|\d+\.\d+|\d+/);

  if (!match) {
    return null;
  }

  const [major = "0", minor = "0", patch = "0"] = match[0].split(".");
  return `${major}.${minor}.${patch}`;
}

export function parseMajor(version: string): number | null {
  const major = Number.parseInt(version.split(".")[0] ?? "", 10);
  return Number.isFinite(major) ? major : null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

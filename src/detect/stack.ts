import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  Node,
  Project,
  ScriptKind,
  SyntaxKind,
  type Expression,
  type ObjectLiteralExpression,
  type SourceFile,
} from "ts-morph";
import { trackedPackageNames } from "../ecosystem/packages.js";
import { detectPackageManager } from "./package-manager.js";
import { detectNextRouter } from "./router.js";
import type { DetectedStack, LintingKind, PackageInfo, StackName } from "../types.js";

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
    const isNextConfig = fileName.startsWith("next.config.");
    const ownsCompilerPlugins = fileName.startsWith("vite.config.") || fileName.startsWith("babel.config.");
    const config = exportedConfigObject(sourceFile);
    if (!config) {
      continue;
    }

    if (isNextConfig) {
      const reactCompiler = propertyInitializer(config, "reactCompiler");
      const cacheComponents = propertyInitializer(config, "cacheComponents");
      if (reactCompiler && (Node.isTrueLiteral(reactCompiler) || Node.isObjectLiteralExpression(reactCompiler))) {
        capabilities.reactCompiler = true;
      }
      if (cacheComponents && Node.isTrueLiteral(cacheComponents)) {
        capabilities.nextCacheComponents = true;
      }
    }

    for (const property of config.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
      const name = propertyName(property.getNameNode());
      const initializer = unwrapExpression(property.getInitializer());

      if (ownsCompilerPlugins && name === "plugins" && initializer && Node.isArrayLiteralExpression(initializer) && hasCompilerPluginElement(initializer.getElements())) {
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

function exportedConfigObject(sourceFile: SourceFile): ObjectLiteralExpression | undefined {
  const exportAssignment = sourceFile.getExportAssignments().find((assignment) => !assignment.isExportEquals());
  if (exportAssignment) {
    return resolveConfigObject(exportAssignment.getExpression(), sourceFile, new Set());
  }

  for (const statement of sourceFile.getStatements()) {
    if (!Node.isExpressionStatement(statement)) {
      continue;
    }
    const expression = unwrapExpression(statement.getExpression());
    if (
      expression
      && Node.isBinaryExpression(expression)
      && expression.getOperatorToken().getKind() === SyntaxKind.EqualsToken
      && expression.getLeft().getText() === "module.exports"
    ) {
      return resolveConfigObject(expression.getRight(), sourceFile, new Set());
    }
  }

  return undefined;
}

function resolveConfigObject(
  expression: Expression,
  sourceFile: SourceFile,
  visited: Set<string>,
): ObjectLiteralExpression | undefined {
  const current = unwrapExpression(expression);
  if (!current) {
    return undefined;
  }
  if (Node.isObjectLiteralExpression(current)) {
    return current;
  }
  if (Node.isIdentifier(current)) {
    const name = current.getText();
    if (visited.has(name)) {
      return undefined;
    }
    visited.add(name);
    const initializer = current.getSymbol()?.getDeclarations().find(Node.isVariableDeclaration)?.getInitializer()
      ?? sourceFile.getVariableDeclaration(name)?.getInitializer();
    return initializer ? resolveConfigObject(initializer, sourceFile, visited) : undefined;
  }
  if (
    Node.isCallExpression(current)
    && current.getExpression().getText() === "defineConfig"
  ) {
    const [argument] = current.getArguments();
    return argument && Node.isExpression(argument)
      ? resolveConfigObject(argument, sourceFile, visited)
      : undefined;
  }

  return undefined;
}

function propertyInitializer(
  object: ObjectLiteralExpression,
  name: string,
): Expression | undefined {
  const property = object.getProperty(name);
  return property && Node.isPropertyAssignment(property)
    ? unwrapExpression(property.getInitializer())
    : undefined;
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

  for (const packageName of trackedPackageNames) {
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

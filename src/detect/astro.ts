import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";
import {
  Node,
  Project,
  ScriptKind,
  SyntaxKind,
  type Expression,
  type ObjectLiteralExpression,
  type SourceFile,
} from "ts-morph";
import type {
  AstroOutputMode,
  AstroProjectProfile,
  AstroUiIntegration,
  PackageInfo,
} from "../types.js";

const astroConfigFiles = [
  "astro.config.js",
  "astro.config.mjs",
  "astro.config.cjs",
  "astro.config.ts",
  "astro.config.mts",
  "astro.config.cts",
] as const;

const sourceExtensions = new Set([".astro", ".ts", ".js", ".mts", ".mjs", ".cts", ".cjs"]);
const ignoredDirectories = new Set(["node_modules", "dist", ".git", ".astro"]);

const uiIntegrationPackages: Record<string, AstroUiIntegration> = {
  "@astrojs/react": "react",
  "@astrojs/preact": "preact",
  "@astrojs/vue": "vue",
  "@astrojs/svelte": "svelte",
  "@astrojs/solid-js": "solid",
  "@astrojs/lit": "lit",
};

const adapterPackages = ["@astrojs/node", "@astrojs/cloudflare", "@astrojs/netlify", "@astrojs/vercel"] as const;

export interface AstroDetectionResult {
  profile: AstroProjectProfile | null;
  warnings: string[];
}

export async function detectAstroProject(
  rootDir: string,
  packages: Record<string, PackageInfo>,
): Promise<AstroDetectionResult> {
  const astroPackage = packages.astro;
  if (!astroPackage?.declaredRange) {
    return { profile: null, warnings: [] };
  }

  const warnings: string[] = [];
  const configResult = await readAstroConfig(rootDir, packages);
  if (configResult.dynamic) {
    warnings.push("Astro config is dynamic; capability detection uses conservative dependency and source fallbacks.");
  }

  const sourceFiles = await readSourceFiles(join(rootDir, "src"));
  const astroFiles = sourceFiles.filter((file) => file.path.endsWith(".astro"));
  const prerenderValues = astroFiles.flatMap((file) => exportedPrerenderValues(file.path, file.content));
  const output = configResult.output ?? "static";
  const hasOppositeRoute = output === "static" ? prerenderValues.includes(false) : prerenderValues.includes(true);
  const contentConfig = sourceFiles.find((file) => basename(file.path).startsWith("content.config."));
  const uiIntegrations = configResult.uiIntegrations.length > 0 || !configResult.dynamic
    ? configResult.uiIntegrations
    : declaredUiIntegrations(packages);

  return {
    profile: {
      version: astroPackage.version,
      major: astroPackage.major,
      output,
      rendering: hasOppositeRoute ? "mixed" : output === "server" ? "server-first" : "static-first",
      adapter: configResult.adapter ?? declaredAdapter(packages),
      uiIntegrations,
      mdx: configResult.mdx || (configResult.dynamic && isDeclared(packages, "@astrojs/mdx")),
      contentCollections: contentConfig
        ? contentConfig.content.includes("liveLoader(") ? "live" : "build"
        : "none",
      actions: sourceFiles.some((file) => file.path.includes("/actions/") || file.content.includes("astro:actions")),
      middleware: sourceFiles.some((file) => basenameWithoutExtension(file.path) === "middleware"),
      sessions: configResult.sessions || sourceFiles.some((file) => file.content.includes("Astro.session") || file.content.includes("context.session")),
      routeCache: configResult.routeCache || sourceFiles.some((file) => hasExportedVariable(file.path, file.content, "cache")),
      i18n: configResult.i18n,
      advancedRouting: sourceFiles.some((file) => normalizePath(relative(rootDir, file.path)) === "src/fetch.ts"),
      clientIslands: astroFiles.some((file) => file.content.includes("client:")),
      serverIslands: astroFiles.some((file) => file.content.includes("server:defer")),
      htmlInjection: astroFiles.some((file) => file.content.includes("set:html")),
      endpoints: sourceFiles.some((file) => isEndpoint(rootDir, file.path)),
      testTools: ["vitest", "jest", "playwright"].filter((packageName) => Boolean(packages[packageName]?.version)),
    },
    warnings,
  };
}

interface AstroConfigResult {
  output: AstroOutputMode | null;
  adapter: string | null;
  uiIntegrations: AstroUiIntegration[];
  mdx: boolean;
  sessions: boolean;
  routeCache: boolean;
  i18n: boolean;
  dynamic: boolean;
}

async function readAstroConfig(
  rootDir: string,
  packages: Record<string, PackageInfo>,
): Promise<AstroConfigResult> {
  const empty: AstroConfigResult = {
    output: null,
    adapter: null,
    uiIntegrations: [],
    mdx: false,
    sessions: false,
    routeCache: false,
    i18n: false,
    dynamic: false,
  };

  for (const fileName of astroConfigFiles) {
    const content = await readOptional(join(rootDir, fileName));
    if (content === null) {
      continue;
    }

    const project = new Project({
      useInMemoryFileSystem: true,
      skipAddingFilesFromTsConfig: true,
      compilerOptions: { allowJs: true },
    });
    const sourceFile = project.createSourceFile(fileName, content, {
      overwrite: true,
      scriptKind: scriptKindFor(fileName),
    });
    const config = exportedConfigObject(sourceFile);
    if (!config) {
      return { ...empty, dynamic: true };
    }

    const imports = astroImportAliases(sourceFile);
    const integrationExpressions = arrayPropertyElements(config, "integrations");
    const configuredPackages = new Set(
      integrationExpressions
        .map((expression) => calledIdentifier(expression))
        .map((identifier) => identifier ? imports.get(identifier) : undefined)
        .filter((packageName): packageName is string => packageName !== undefined),
    );
    const adapterIdentifier = calledIdentifier(propertyInitializer(config, "adapter"));
    const adapterPackage = adapterIdentifier ? imports.get(adapterIdentifier) : undefined;
    const outputValue = stringProperty(config, "output");

    return {
      output: outputValue === "server" || outputValue === "static" ? outputValue : null,
      adapter: adapterPackage ? adapterName(adapterPackage) : null,
      uiIntegrations: Object.entries(uiIntegrationPackages)
        .filter(([packageName]) => configuredPackages.has(packageName))
        .map(([, integration]) => integration),
      mdx: configuredPackages.has("@astrojs/mdx"),
      sessions: config.getProperty("session") !== undefined,
      routeCache: config.getProperty("cache") !== undefined,
      i18n: config.getProperty("i18n") !== undefined,
      dynamic: false,
    };
  }

  return {
    ...empty,
    uiIntegrations: declaredUiIntegrations(packages),
    mdx: isDeclared(packages, "@astrojs/mdx"),
  };
}

function astroImportAliases(sourceFile: SourceFile): Map<string, string> {
  const imports = new Map<string, string>();
  for (const declaration of sourceFile.getImportDeclarations()) {
    const packageName = declaration.getModuleSpecifierValue();
    if (!(packageName in uiIntegrationPackages) && packageName !== "@astrojs/mdx" && !adapterPackages.includes(packageName as typeof adapterPackages[number])) {
      continue;
    }
    const defaultImport = declaration.getDefaultImport();
    if (defaultImport) {
      imports.set(defaultImport.getText(), packageName);
    }
  }
  return imports;
}

function declaredUiIntegrations(packages: Record<string, PackageInfo>): AstroUiIntegration[] {
  return Object.entries(uiIntegrationPackages)
    .filter(([packageName]) => isDeclared(packages, packageName))
    .map(([, integration]) => integration);
}

function declaredAdapter(packages: Record<string, PackageInfo>): string | null {
  const packageName = adapterPackages.find((candidate) => isDeclared(packages, candidate));
  return packageName ? adapterName(packageName) : null;
}

function adapterName(packageName: string): string {
  return packageName.startsWith("@astrojs/") ? packageName.slice("@astrojs/".length) : packageName;
}

function isDeclared(packages: Record<string, PackageInfo>, packageName: string): boolean {
  return packages[packageName]?.declaredRange !== null && packages[packageName]?.declaredRange !== undefined;
}

function exportedConfigObject(sourceFile: SourceFile): ObjectLiteralExpression | undefined {
  const assignment = sourceFile.getExportAssignments().find((candidate) => !candidate.isExportEquals());
  if (assignment) {
    return resolveConfigObject(assignment.getExpression(), sourceFile, new Set());
  }

  for (const statement of sourceFile.getStatements()) {
    if (!Node.isExpressionStatement(statement)) {
      continue;
    }
    const expression = unwrapExpression(statement.getExpression());
    if (
      Node.isBinaryExpression(expression)
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
  if (Node.isObjectLiteralExpression(current)) {
    return current;
  }
  if (Node.isIdentifier(current)) {
    const name = current.getText();
    if (visited.has(name)) {
      return undefined;
    }
    visited.add(name);
    const initializer = sourceFile.getVariableDeclaration(name)?.getInitializer();
    return initializer && Node.isExpression(initializer)
      ? resolveConfigObject(initializer, sourceFile, visited)
      : undefined;
  }
  if (Node.isCallExpression(current) && current.getExpression().getText() === "defineConfig") {
    const [argument] = current.getArguments();
    return argument && Node.isExpression(argument)
      ? resolveConfigObject(argument, sourceFile, visited)
      : undefined;
  }
  return undefined;
}

function stringProperty(object: ObjectLiteralExpression, name: string): string | null {
  const initializer = propertyInitializer(object, name);
  return initializer && Node.isStringLiteral(initializer) ? initializer.getLiteralValue() : null;
}

function propertyInitializer(object: ObjectLiteralExpression, name: string): Expression | undefined {
  const property = object.getProperty(name);
  const initializer = property && Node.isPropertyAssignment(property) ? property.getInitializer() : undefined;
  return initializer && Node.isExpression(initializer) ? unwrapExpression(initializer) : undefined;
}

function arrayPropertyElements(object: ObjectLiteralExpression, name: string): Expression[] {
  const initializer = propertyInitializer(object, name);
  if (!initializer || !Node.isArrayLiteralExpression(initializer)) {
    return [];
  }
  return initializer.getElements().filter((element): element is Expression => Node.isExpression(element));
}

function calledIdentifier(expression: Expression | undefined): string | null {
  if (!expression || !Node.isCallExpression(expression)) {
    return null;
  }
  const callee = unwrapExpression(expression.getExpression());
  return callee && Node.isIdentifier(callee) ? callee.getText() : null;
}

function unwrapExpression(expression: Expression): Expression {
  let current = expression;
  while (Node.isParenthesizedExpression(current) || Node.isAsExpression(current) || Node.isSatisfiesExpression(current)) {
    current = current.getExpression();
  }
  return current;
}

function scriptKindFor(fileName: string): ScriptKind {
  return fileName.endsWith(".ts") || fileName.endsWith(".mts") || fileName.endsWith(".cts")
    ? ScriptKind.TS
    : ScriptKind.JS;
}

interface SourceEntry {
  path: string;
  content: string;
}

async function readSourceFiles(dir: string): Promise<SourceEntry[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const nested = await Promise.all(entries.map(async (entry): Promise<SourceEntry[]> => {
    if (ignoredDirectories.has(entry.name)) {
      return [];
    }
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return readSourceFiles(path);
    }
    if (!entry.isFile() || !sourceExtensions.has(extname(entry.name))) {
      return [];
    }
    return [{ path, content: await readFile(path, "utf8") }];
  }));
  return nested.flat();
}

function exportedPrerenderValues(path: string, content: string): boolean[] {
  if (!path.endsWith(".astro")) {
    return [];
  }
  const frontmatter = astroFrontmatter(content);
  return frontmatter === null ? [] : exportedBooleanValues(path, frontmatter, "prerender");
}

function hasExportedVariable(path: string, content: string, name: string): boolean {
  const source = path.endsWith(".astro") ? astroFrontmatter(content) : content;
  return source !== null && exportedBooleanValues(path, source, name, true).length > 0;
}

function exportedBooleanValues(path: string, source: string, name: string, acceptAny = false): boolean[] {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  const sourceFile = project.createSourceFile(`${basename(path)}.ts`, source, { overwrite: true, scriptKind: ScriptKind.TS });
  return sourceFile.getVariableDeclarations()
    .filter((declaration) => declaration.getName() === name && declaration.getVariableStatement()?.isExported())
    .flatMap((declaration) => {
      const initializer = declaration.getInitializer();
      if (Node.isTrueLiteral(initializer)) {
        return [true];
      }
      if (Node.isFalseLiteral(initializer)) {
        return [false];
      }
      return acceptAny && initializer ? [true] : [];
    });
}

function astroFrontmatter(content: string): string | null {
  const start = content.indexOf("---");
  if (start !== 0) {
    return null;
  }
  const end = content.indexOf("---", 3);
  return end === -1 ? null : content.slice(3, end);
}

function isEndpoint(rootDir: string, path: string): boolean {
  const relativePath = normalizePath(relative(rootDir, path));
  return relativePath.startsWith("src/pages/") && !path.endsWith(".astro") && sourceExtensions.has(extname(path));
}

function basenameWithoutExtension(path: string): string {
  const name = basename(path);
  return name.slice(0, name.length - extname(name).length);
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/");
}

async function readOptional(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

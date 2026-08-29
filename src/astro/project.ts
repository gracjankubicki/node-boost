import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";
import { Node, Project, ScriptKind } from "ts-morph";
import type { AstroProjectProfile } from "../types.js";
import { parseAstroSource } from "./source.js";

const pageExtensions = new Set([".astro", ".md", ".mdx", ".html", ".js", ".ts", ".mjs", ".mts", ".cjs", ".cts"]);
const endpointExtensions = new Set([".js", ".ts", ".mjs", ".mts", ".cjs", ".cts"]);

export interface AstroRouteInfo {
  path: string;
  type: "page" | "endpoint";
  file: string;
  dynamic: string[];
  rendering: "static" | "on-demand";
  partial: boolean;
}

export interface AstroIslandInfo {
  component: string;
  directive: string;
  kind: "client" | "server";
  file: string;
  line: number | null;
}

export interface AstroArchitectureMap {
  contentConfig: string[];
  actions: string[];
  middleware: string[];
  advancedRouting: string[];
}

export async function inspectAstroProject(
  rootDir: string,
  profile: AstroProjectProfile,
): Promise<{ routes: AstroRouteInfo[]; islands: AstroIslandInfo[]; architecture: AstroArchitectureMap }> {
  const sourceFiles = await walkFiles(join(rootDir, "src"));
  const pageFiles = sourceFiles.filter((file) => isPageFile(rootDir, file));
  const routes = await Promise.all(pageFiles.map((file) => routeInfo(rootDir, file, profile)));
  const islands = (await Promise.all(sourceFiles.filter((file) => file.endsWith(".astro")).map(async (file) => {
    const document = await parseAstroSource(await readFile(file, "utf8"));
    return document.islands.map((island) => ({
      ...island,
      file: normalizePath(relative(rootDir, file)),
    }));
  }))).flat();

  return {
    routes: routes.sort(compareRoutes),
    islands: islands.sort((left, right) => left.file.localeCompare(right.file) || (left.line ?? 0) - (right.line ?? 0)),
    architecture: {
      contentConfig: matchingFiles(rootDir, sourceFiles, (file) => /(?:^|\/)content\.config\.[^/]+$/.test(normalizePath(file))),
      actions: matchingFiles(rootDir, sourceFiles, (file) => normalizePath(file).includes("/actions/")),
      middleware: matchingFiles(rootDir, sourceFiles, (file) => /(?:^|\/)middleware\.[^/]+$/.test(normalizePath(file))),
      advancedRouting: matchingFiles(rootDir, sourceFiles, (file) => normalizePath(relative(rootDir, file)) === "src/fetch.ts"),
    },
  };
}

async function routeInfo(rootDir: string, file: string, profile: AstroProjectProfile): Promise<AstroRouteInfo> {
  const extension = extname(file);
  const relativePagesPath = normalizePath(relative(join(rootDir, "src", "pages"), file));
  const withoutExtension = relativePagesPath.slice(0, -extension.length);
  const segments = withoutExtension.split("/");
  if (segments.at(-1) === "index") {
    segments.pop();
  }
  const source = await readFile(file, "utf8");
  const frontmatter = extension === ".astro" ? (await parseAstroSource(source)).frontmatter : endpointExtensions.has(extension) ? source : null;
  const prerender = frontmatter ? exportedBoolean(frontmatter, "prerender") : null;
  const partial = frontmatter ? exportedBoolean(frontmatter, "partial") === true : false;
  const rendering = prerender === null
    ? profile.output === "static" ? "static" : "on-demand"
    : prerender ? "static" : "on-demand";

  return {
    path: `/${segments.join("/")}`.replace(/\/+/g, "/"),
    type: endpointExtensions.has(extension) ? "endpoint" : "page",
    file: normalizePath(relative(rootDir, file)),
    dynamic: extractDynamicSegments(segments),
    rendering,
    partial,
  };
}

function exportedBoolean(source: string, name: string): boolean | null {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  const sourceFile = project.createSourceFile("route.ts", source, { overwrite: true, scriptKind: ScriptKind.TS });
  const declaration = sourceFile.getVariableDeclarations()
    .find((candidate) => candidate.getName() === name && candidate.getVariableStatement()?.isExported());
  const initializer = declaration?.getInitializer();
  if (Node.isTrueLiteral(initializer)) {
    return true;
  }
  if (Node.isFalseLiteral(initializer)) {
    return false;
  }
  return null;
}

function isPageFile(rootDir: string, file: string): boolean {
  const relativePath = normalizePath(relative(join(rootDir, "src", "pages"), file));
  return !relativePath.startsWith("../")
    && pageExtensions.has(extname(file))
    && !relativePath.split("/").some((segment) => segment.startsWith("_"));
}

async function walkFiles(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = await Promise.all(entries.map(async (entry): Promise<string[]> => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return walkFiles(path);
    }
    return entry.isFile() ? [path] : [];
  }));
  return files.flat();
}

function matchingFiles(rootDir: string, files: string[], predicate: (file: string) => boolean): string[] {
  return files.filter(predicate).map((file) => normalizePath(relative(rootDir, file))).sort((a, b) => a.localeCompare(b));
}

function extractDynamicSegments(segments: string[]): string[] {
  return segments
    .map((segment) => segment.match(/^\[\.{0,3}([^\]]+)\]$/)?.[1] ?? null)
    .filter((segment): segment is string => segment !== null);
}

function compareRoutes(left: AstroRouteInfo, right: AstroRouteInfo): number {
  return left.path.localeCompare(right.path) || left.type.localeCompare(right.type) || left.file.localeCompare(right.file);
}

function normalizePath(path: string): string {
  return path.split(sep).join("/");
}

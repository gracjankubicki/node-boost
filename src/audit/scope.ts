import { execFile } from "node:child_process";
import { realpath, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { promisify } from "node:util";
import picomatch from "picomatch";
import type { NodeBoostConfig } from "../config/schema.js";
import { splitTextLines } from "./rules/helpers.js";
import type { AuditFinding, AuditScopeResult } from "./rule.js";

const execFileAsync = promisify(execFile);
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"]);
const excludedDirectoryNames = new Set(["node_modules", "dist", ".next", "coverage"]);
const defaultExcludes = [...excludedDirectoryNames].flatMap((directory) => [`${directory}/**`, `**/${directory}/**`]);

export interface ResolveScopeOptions {
  rootDir: string;
  config: NodeBoostConfig;
  mode: "all" | "changed" | "base" | "paths";
  base?: string;
  paths?: string[];
}

export async function resolveAuditScope(options: ResolveScopeOptions): Promise<AuditScopeResult> {
  const warnings: AuditFinding[] = [];
  const rawFiles = await resolveRawFiles(options, warnings);
  const files = filterSourceFiles(rawFiles, options.config.audit.exclude);
  const allPaths = options.mode === "all"
    ? files
    : filterSourceFiles(await walkFiles(options.rootDir), options.config.audit.exclude);

  return {
    mode: options.mode,
    files,
    allPaths,
    warnings,
  };
}

async function resolveRawFiles(options: ResolveScopeOptions, warnings: AuditFinding[]): Promise<string[]> {
  if (options.mode === "paths") {
    return options.paths ?? [];
  }

  if (options.mode === "all") {
    return walkFiles(options.rootDir);
  }

  if (options.mode === "base") {
    try {
      const gitRoot = await findGitRoot(options.rootDir);
      const mergeBase = (await execGit(gitRoot, ["merge-base", options.base ?? "main", "HEAD"])).trim();
      const diff = await execGit(gitRoot, ["diff", "--name-only", "--diff-filter=ACMR", mergeBase, "HEAD"]);
      return gitPathsToProjectRelative(gitRoot, options.rootDir, splitLines(diff));
    } catch {
      warnings.push(metaWarning("NB-META-004", "git-base-fallback-all"));
      return walkFiles(options.rootDir);
    }
  }

  try {
    const gitRoot = await findGitRoot(options.rootDir);
    const tracked = await execGit(gitRoot, ["diff", "--name-only", "--diff-filter=ACMR", "HEAD"]);
    const untracked = await execGit(gitRoot, ["ls-files", "--others", "--exclude-standard"]);
    return gitPathsToProjectRelative(gitRoot, options.rootDir, [...splitLines(tracked), ...splitLines(untracked)]);
  } catch {
    warnings.push(metaWarning("NB-META-004", "git-changed-fallback-all"));
    return walkFiles(options.rootDir);
  }
}

function filterSourceFiles(files: string[], configuredExcludes: string[]): string[] {
  const excludes = picomatch([...defaultExcludes, ...configuredExcludes]);
  return [...new Set(files.map(toPosix))]
    .filter((file) => sourceExtensions.has(extname(file)))
    .filter((file) => !excludes(file))
    .sort((a, b) => a.localeCompare(b));
}

async function walkFiles(rootDir: string, dir = rootDir): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = join(dir, entry.name);
      const rel = toPosix(relative(rootDir, absolutePath));

      if (entry.isDirectory()) {
        if (excludedDirectoryNames.has(entry.name)) {
          return [];
        }

        return walkFiles(rootDir, absolutePath);
      }

      return entry.isFile() ? [rel] : [];
    }),
  );

  return files.flat();
}

async function execGit(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout;
}

async function findGitRoot(rootDir: string): Promise<string> {
  return realpath((await execGit(rootDir, ["rev-parse", "--show-toplevel"])).trim());
}

async function gitPathsToProjectRelative(gitRootInput: string, rootDir: string, files: string[]): Promise<string[]> {
  const gitRoot = await realpath(gitRootInput);
  const projectRoot = await realpath(rootDir);
  const projectPrefix = toPosix(relative(gitRoot, projectRoot));

  if (!projectPrefix) {
    return files;
  }

  return files
    .map(toPosix)
    .filter((file) => file === projectPrefix || file.startsWith(`${projectPrefix}/`))
    .map((file) => {
      const relativePath = file.slice(projectPrefix.length);
      return relativePath.startsWith("/") ? relativePath.slice(1) : relativePath;
    });
}

function splitLines(value: string): string[] {
  return splitTextLines(value).map((line) => line.trim()).filter(Boolean);
}

function toPosix(path: string): string {
  return path.replaceAll("\\", "/");
}

function metaWarning(rule: string, code: string): AuditFinding {
  return {
    rule,
    sev: "warn",
    file: "<project>",
    line: 1,
    code,
  };
}

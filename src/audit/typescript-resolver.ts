import { relative } from "node:path";
import { ts } from "ts-morph";
import { readTypeScriptConfig } from "../config/typescript-config.js";
import type { AuditFile, AuditFinding } from "./rule.js";

const sourceModuleExtensions = new Set(["cjs", "cts", "js", "jsx", "mjs", "mts", "ts", "tsx"]);

export interface TypeScriptModuleResolver {
  resolve(file: AuditFile, specifier: string, line: number): string | null;
  warnings(): AuditFinding[];
}

export function createTypeScriptModuleResolver(rootDir: string): TypeScriptModuleResolver {
  const compilerOptions = readCompilerOptions(rootDir);
  const aliasPatterns = Object.keys(compilerOptions.paths ?? {});
  const cache = ts.createModuleResolutionCache(
    rootDir,
    ts.sys.useCaseSensitiveFileNames ? (value) => value : (value) => value.toLowerCase(),
    compilerOptions,
  );
  const resolutionWarnings = new Map<string, AuditFinding>();

  return {
    resolve(file, specifier, line) {
      const resolution = ts.resolveModuleName(specifier, file.absolutePath, compilerOptions, ts.sys, cache).resolvedModule;
      if (!resolution) {
        if (
          isSourceModuleSpecifier(specifier)
          && (specifier.startsWith(".") || aliasPatterns.some((pattern) => matchesAliasPattern(specifier, pattern)))
        ) {
          const key = `${file.path}:${line}:${specifier}`;
          resolutionWarnings.set(key, {
            rule: "NB-META-006",
            sev: "warn",
            file: file.path,
            line,
            code: "module-resolution-failed",
            ref: specifier,
          });
        }
        return null;
      }

      if (resolution.isExternalLibraryImport) {
        return null;
      }

      const projectPath = toPosix(relative(rootDir, resolution.resolvedFileName));
      return projectPath === ".." || projectPath.startsWith("../") ? null : projectPath;
    },
    warnings() {
      return [...resolutionWarnings.values()];
    },
  };
}

function isSourceModuleSpecifier(specifier: string): boolean {
  const clean = specifier.split("?")[0]?.split("#")[0] ?? specifier;
  const segment = clean.split("/").at(-1) ?? "";
  const dot = segment.lastIndexOf(".");
  return dot === -1 || sourceModuleExtensions.has(segment.slice(dot + 1));
}

function readCompilerOptions(rootDir: string): ts.CompilerOptions {
  const defaults: ts.CompilerOptions = {
    allowJs: true,
    jsx: ts.JsxEmit.ReactJSX,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  };
  return { ...defaults, ...readTypeScriptConfig(rootDir).compilerOptions };
}

function matchesAliasPattern(specifier: string, pattern: string): boolean {
  const wildcard = pattern.indexOf("*");
  if (wildcard === -1) {
    return specifier === pattern;
  }

  const prefix = pattern.slice(0, wildcard);
  const suffix = pattern.slice(wildcard + 1);
  return specifier.startsWith(prefix) && specifier.endsWith(suffix);
}

function toPosix(path: string): string {
  return path.replaceAll("\\", "/");
}

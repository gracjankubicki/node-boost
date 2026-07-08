import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import picomatch from "picomatch";
import type { AuditFile, AuditFinding } from "../rule.js";

export function hasUseClientDirective(file: AuditFile): boolean {
  return file.lines.some((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) {
      return false;
    }

    return trimmed === '"use client";' || trimmed === '"use client"' || trimmed === "'use client';" || trimmed === "'use client'";
  });
}

export function isClientComponent(file: AuditFile, stackName: string): boolean {
  return stackName === "vite-react" || hasUseClientDirective(file);
}

export function isDataLayerFile(file: AuditFile, globs: string[]): boolean {
  if (file.path.endsWith("/route.ts") || file.path.endsWith("/route.tsx")) {
    return true;
  }

  return picomatch(globs)(file.path);
}

export function dataLayerGlobs(options: Record<string, unknown>): string[] {
  const configured = options.dataLayerGlobs;
  return Array.isArray(configured) && configured.every((item) => typeof item === "string")
    ? configured
    : ["**/api/**", "**/server/**", "lib/api/**", "src/lib/api/**"];
}

export function lineOf(content: string, pattern: RegExp): number {
  const lines = content.split(/\r?\n/);
  const index = lines.findIndex((line) => pattern.test(line));
  return index >= 0 ? index + 1 : 1;
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

export function importSpecs(file: AuditFile): Array<{ spec: string; line: number }> {
  const specs: Array<{ spec: string; line: number }> = [];
  const patterns = [
    /^\s*import\s+(?:type\s+)?(?:[^'"]+\s+from\s+)?["']([^"']+)["']/,
    /^\s*export\s+[^'"]+\s+from\s+["']([^"']+)["']/,
  ];

  file.lines.forEach((line, index) => {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match?.[1]) {
        specs.push({ spec: match[1], line: index + 1 });
      }
    }
  });

  return specs;
}

export function resolveImportPath(file: AuditFile, spec: string): string {
  if (spec.startsWith(".")) {
    return toPosix(normalize(join(dirname(file.path), spec)));
  }

  return spec.replace(/^@\/?/, "").replace(/^~\/?/, "");
}

export function isConfigFile(path: string): boolean {
  return /(^|\/)[^/]*\.config\.[cm]?[jt]sx?$/.test(path);
}

export function firstImportIndex(file: AuditFile): number {
  const index = file.lines.findIndex((line) => line.trim().startsWith("import "));
  return index >= 0 ? index : file.lines.length;
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

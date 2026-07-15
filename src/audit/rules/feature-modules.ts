import { existsSync } from "node:fs";
import { join } from "node:path";
import type { AuditFile, AuditRule } from "../rule.js";
import { finding } from "./helpers.js";

export const featureModuleRules: AuditRule[] = [
  {
    id: "NB-ARCH-001",
    code: "cross-feature-deep-import",
    architecture: "feature-modules",
    defaultSeverity: "err",
    stacks: ["next", "vite-react"],
    kind: "ast",
    check(context) {
      const featuresDir = normalizeDirectory(
        typeof context.ruleOptions.featuresDir === "string" ? context.ruleOptions.featuresDir : "src/features",
      );

      if (!existsSync(join(context.rootDir, featuresDir))) {
        return [];
      }

      const boundary = context.architectureOptions.boundary === "forbid" ? "forbid" : "public-api";

      return context.files.flatMap((file) => {
        const sourceFeature = featureName(file.path, featuresDir);
        if (!sourceFeature) {
          return [];
        }

        return moduleSpecs(file).flatMap(({ specifier, line }) => {
          const targetPath = context.moduleResolver.resolve(file, specifier, line);
          const targetFeature = targetPath ? featureName(targetPath, featuresDir) : null;

          if (!targetPath || !targetFeature || targetFeature === sourceFeature) {
            return [];
          }

          const allowedPublicApi = boundary === "public-api" && isFeaturePublicApi(targetPath, featuresDir, targetFeature);
          return allowedPublicApi ? [] : [finding(file, "NB-ARCH-001", "cross-feature-deep-import", line, targetPath)];
        });
      });
    },
  },
  {
    id: "NB-ARCH-002",
    code: "feature-imports-app",
    architecture: "feature-modules",
    defaultSeverity: "err",
    stacks: ["next", "vite-react"],
    kind: "ast",
    check(context) {
      const featuresDir = normalizeDirectory(
        typeof context.ruleOptions.featuresDir === "string" ? context.ruleOptions.featuresDir : "src/features",
      );

      return context.files.flatMap((file) => {
        if (!featureName(file.path, featuresDir)) {
          return [];
        }

        return moduleSpecs(file).flatMap(({ specifier, line }) => {
          const target = context.moduleResolver.resolve(file, specifier, line);
          return target && isAppLayer(target)
            ? [finding(file, "NB-ARCH-002", "feature-imports-app", line, target)]
            : [];
        });
      });
    },
  },
];

function moduleSpecs(file: AuditFile): Array<{ specifier: string; line: number }> {
  if (!file.sourceFile) {
    return [];
  }

  const imports = file.sourceFile.getImportDeclarations().map((declaration) => ({
    specifier: declaration.getModuleSpecifierValue(),
    line: declaration.getStartLineNumber(),
  }));
  const exports = file.sourceFile.getExportDeclarations().flatMap((declaration) => {
    const specifier = declaration.getModuleSpecifierValue();
    return specifier ? [{ specifier, line: declaration.getStartLineNumber() }] : [];
  });

  return [...imports, ...exports];
}

function featureName(path: string, featuresDir: string): string | null {
  const prefix = `${featuresDir}/`;
  if (!path.startsWith(prefix)) {
    return null;
  }

  const remainder = path.slice(prefix.length);
  const separator = remainder.indexOf("/");
  return separator === -1 ? null : remainder.slice(0, separator);
}

function isFeaturePublicApi(path: string, featuresDir: string, feature: string): boolean {
  const featureRoot = `${featuresDir}/${feature}/`;
  if (!path.startsWith(featureRoot)) {
    return false;
  }

  const target = path.slice(featureRoot.length);
  return target === "index.ts"
    || target === "index.tsx"
    || target === "index.mts"
    || target === "index.cts"
    || target === "index.js"
    || target === "index.jsx"
    || target === "index.mjs"
    || target === "index.cjs";
}

function isAppLayer(path: string): boolean {
  const parts = path.split("/");
  const first = parts[0];
  const second = parts[1];
  return first === "app" || first === "routes" || (first === "src" && (second === "app" || second === "routes"));
}

function normalizeDirectory(path: string): string {
  let normalized = path.replaceAll("\\", "/");
  while (normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

import { existsSync } from "node:fs";
import { join } from "node:path";
import type { AuditRule } from "../rule.js";
import { finding, importSpecs, resolveImportPath } from "./helpers.js";

export const featureModuleRules: AuditRule[] = [
  {
    id: "NB-ARCH-001",
    code: "cross-feature-deep-import",
    architecture: "feature-modules",
    defaultSeverity: "err",
    stacks: ["next", "vite-react"],
    kind: "line",
    check(context) {
      const featuresDir = typeof context.ruleOptions.featuresDir === "string" ? context.ruleOptions.featuresDir : "src/features";
      const normalizedFeaturesDir = featuresDir.replace(/\/$/, "");

      if (!existsSync(join(context.rootDir, normalizedFeaturesDir))) {
        return [];
      }

      const boundary = context.architectureOptions.boundary === "forbid" ? "forbid" : "public-api";

      return context.files.flatMap((file) => {
        const sourceFeature = featureName(file.path, normalizedFeaturesDir);
        if (!sourceFeature) {
          return [];
        }

        return importSpecs(file).flatMap(({ spec, line }) => {
          const targetPath = resolveImportPath(file, spec);
          const targetFeature = featureName(targetPath, normalizedFeaturesDir);

          if (!targetFeature || targetFeature === sourceFeature) {
            return [];
          }

          const suffix = targetPath.slice(`${normalizedFeaturesDir}/${targetFeature}/`.length);
          const allowedPublicApi = boundary === "public-api" && (suffix === "index" || suffix === "index.ts" || suffix === "index.tsx");

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
    kind: "line",
    check(context) {
      const featuresDir = typeof context.ruleOptions.featuresDir === "string" ? context.ruleOptions.featuresDir : "src/features";
      return context.files.flatMap((file) => {
        if (!featureName(file.path, featuresDir)) {
          return [];
        }

        return importSpecs(file).flatMap(({ spec, line }) => {
          const target = resolveImportPath(file, spec);
          return /^(src\/)?(app|routes)(\/|$)/.test(target) ? [finding(file, "NB-ARCH-002", "feature-imports-app", line, target)] : [];
        });
      });
    },
  },
];

function featureName(path: string, featuresDir: string): string | null {
  const normalized = featuresDir.replace(/\/$/, "");
  const prefix = `${normalized}/`;

  if (!path.startsWith(prefix)) {
    return null;
  }

  return path.slice(prefix.length).split("/")[0] ?? null;
}

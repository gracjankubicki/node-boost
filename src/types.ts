export type PackageManagerName = "npm" | "pnpm" | "yarn" | "bun";

export interface PackageManagerInfo {
  name: PackageManagerName;
  lockfile: string | null;
  version: string | null;
  source: "lockfile" | "packageManagerField" | "default";
}

export type StackName = "next" | "vite-react" | "react-generic" | "unknown";

export type RouterKind = "app" | "pages" | "react-router" | "none" | "unknown";

export type LintingKind = "biome" | "eslint-prettier" | "eslint" | "none";

export interface PackageInfo {
  name: string;
  declaredRange: string | null;
  version: string | null;
  major: number | null;
  source: "node_modules" | "range" | "missing";
}

export interface DetectedStack {
  rootDir: string;
  name: StackName;
  router: RouterKind;
  srcDir: boolean;
  linting: LintingKind;
  packageManager: PackageManagerInfo;
  packages: Record<string, PackageInfo>;
  warnings: string[];
}

export type AgentName = "claude-code" | "codex" | "cursor";

export type FeatureName = "guidelines" | "skills" | "mcp" | "architecture" | "hooks";

export type ArchitectureSlug =
  | "feature-modules"
  | "server-first-components"
  | "data-access-layer"
  | "typed-contracts"
  | "state-management"
  | "custom-hooks"
  | "component-composition"
  | "styling-tailwind"
  | "testing-strategy"
  | "error-loading-boundaries"
  | "secure-by-default"
  | "modern-typescript"
  | "ui-states";

export type FeatureModulesBoundary = "public-api" | "forbid";

export type ArchitectureConfigEntry =
  | ArchitectureSlug
  | `${string}:${string}`
  | { name: "feature-modules"; boundary?: FeatureModulesBoundary }
  | {
      name: Exclude<ArchitectureSlug, "feature-modules">;
    }
  | { name: `${string}:${string}`; variant?: string };

export interface NormalizedArchitecture {
  name: string;
  options: Record<string, unknown>;
}

export interface StackAdapter {
  name: StackName;
  label: string;
  supports(stack: DetectedStack): boolean;
  recommendedArchitectures(stack: DetectedStack): ArchitectureSlug[];
  applicableArchitectures(stack: DetectedStack): ArchitectureSlug[];
}

export interface ResourceSelection {
  kind: "guideline" | "skill";
  sourcePath: string;
  outputPath: string;
  packageName?: string;
  packageMajor?: number;
  pluginPackage?: string;
}

export interface AgentCapabilities {
  supportsGuidelines: boolean;
  supportsSkills: boolean;
  supportsMcp: boolean;
  supportsHooks: boolean;
}

export interface Agent {
  name: AgentName;
  capabilities: AgentCapabilities;
}

export type PackageManagerName = "npm" | "pnpm" | "yarn" | "bun";

export interface PackageManagerInfo {
  name: PackageManagerName;
  lockfile: string | null;
  source: "lockfile" | "packageManagerField" | "default";
}

export type StackName = "next" | "vite-react" | "react-generic" | "unknown";

export type RouterKind = "app" | "pages" | "react-router" | "none" | "unknown";

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
  | "error-loading-boundaries";

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
}

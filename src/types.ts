export type PackageManagerName = "npm" | "pnpm" | "yarn" | "bun";

export interface PackageManagerInfo {
  name: PackageManagerName;
  lockfile: string | null;
  version: string | null;
  source: "lockfile" | "packageManagerField" | "default";
}

export type StackName = "next" | "vite-react" | "astro" | "react-generic" | "unknown";

export type RouterKind = "app" | "pages" | "react-router" | "none" | "unknown";

export type LintingKind = "biome" | "eslint-prettier" | "eslint" | "none";

export interface PackageInfo {
  name: string;
  declaredRange: string | null;
  version: string | null;
  major: number | null;
  source: "node_modules" | "range" | "missing";
}

export interface DetectedCapabilities {
  reactCompiler: boolean;
  nextCacheComponents: boolean;
}

export type AstroOutputMode = "static" | "server";

export type AstroRenderingMode = "static-first" | "server-first" | "mixed";

export type AstroContentMode = "none" | "build" | "live";

export type AstroUiIntegration = "react" | "preact" | "vue" | "svelte" | "solid" | "lit";

export interface AstroProjectProfile {
  version: string | null;
  major: number | null;
  output: AstroOutputMode;
  rendering: AstroRenderingMode;
  adapter: string | null;
  uiIntegrations: AstroUiIntegration[];
  mdx: boolean;
  contentCollections: AstroContentMode;
  actions: boolean;
  middleware: boolean;
  sessions: boolean;
  routeCache: boolean;
  i18n: boolean;
  advancedRouting: boolean;
  clientIslands: boolean;
  serverIslands: boolean;
  htmlInjection: boolean;
  endpoints: boolean;
  testTools: string[];
}

export interface DetectedStack {
  rootDir: string;
  name: StackName;
  router: RouterKind;
  srcDir: boolean;
  linting: LintingKind;
  packageManager: PackageManagerInfo;
  packages: Record<string, PackageInfo>;
  rendering?: import("./detect/rendering.js").RenderingFacts;
  testTools?: string[];
  nodeTest?: import("./detect/testing.js").NodeTestCapability | null;
  capabilities: DetectedCapabilities;
  astro: AstroProjectProfile | null;
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
  | "ui-states"
  | "islands-architecture"
  | "rendering-strategy"
  | "content-modeling"
  | "request-boundaries"
  | "multi-framework-boundaries";

export type FeatureModulesBoundary = "public-api" | "forbid";

export type RenderingStrategyVariant = AstroRenderingMode;

export type ArchitectureConfigEntry =
  | ArchitectureSlug
  | `${string}:${string}`
  | { name: "feature-modules"; boundary?: FeatureModulesBoundary }
  | { name: "rendering-strategy"; variant?: RenderingStrategyVariant }
  | {
      name: Exclude<ArchitectureSlug, "feature-modules" | "rendering-strategy">;
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

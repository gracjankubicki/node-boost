export {
  architectureEntrySchema,
  featureModulesBoundarySchema,
  normalizeArchitectures,
  parseNodeBoostConfig,
  nodeBoostConfigSchema,
} from "./config/schema.js";
export { createNodeBoostJsonSchema } from "./config/json-schema.js";
export { detectStack, extractVersionFromRange, parseMajor } from "./detect/stack.js";
export { detectPackageManager } from "./detect/package-manager.js";
export { detectNextRouter } from "./detect/router.js";
export { composeGuidelines } from "./compose/guidelines.js";
export { composeSkills } from "./compose/skills.js";
export { renderGuidelinesIndex } from "./compose/index-file.js";
export { applyResourceOverrides } from "./compose/overrides.js";
export {
  applyFileOperations,
  buildInstallOperations,
  runInstall,
  runUpdate,
} from "./install/orchestrator.js";
export { getStackAdapter, stackAdapters } from "./stacks/adapter.js";
export type {
  Agent,
  AgentCapabilities,
  AgentName,
  ArchitectureConfigEntry,
  ArchitectureSlug,
  DetectedStack,
  FeatureModulesBoundary,
  FeatureName,
  LintingKind,
  NormalizedArchitecture,
  PackageInfo,
  PackageManagerInfo,
  PackageManagerName,
  ResourceSelection,
  RouterKind,
  StackAdapter,
  StackName,
} from "./types.js";

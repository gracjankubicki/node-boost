export { parseNodeBoostConfig, nodeBoostConfigSchema } from "./config/schema.js";
export { detectStack, extractVersionFromRange, parseMajor } from "./detect/stack.js";
export { detectPackageManager } from "./detect/package-manager.js";
export { detectNextRouter } from "./detect/router.js";
export { composeGuidelines } from "./compose/guidelines.js";
export { composeSkills } from "./compose/skills.js";
export { getStackAdapter, stackAdapters } from "./stacks/adapter.js";
export type {
  AgentName,
  ArchitectureSlug,
  DetectedStack,
  FeatureName,
  PackageInfo,
  PackageManagerInfo,
  PackageManagerName,
  ResourceSelection,
  RouterKind,
  StackAdapter,
  StackName,
} from "./types.js";

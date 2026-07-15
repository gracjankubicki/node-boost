/**
 * Experimental JavaScript API for the 0.1.x line.
 *
 * The CLI and MCP protocols are the stable product surface. Root exports remain
 * available throughout 0.1.x, but new extension code should wait for the
 * dedicated `@node-boost/node-boost/plugin` contract planned for 0.2.0.
 *
 * @packageDocumentation
 */
export {
  architectureEntrySchema,
  featureModulesBoundarySchema,
  normalizeArchitectures,
  parseNodeBoostConfig,
  nodeBoostConfigSchema,
} from "./config/schema.js";
export { createNodeBoostJsonSchema } from "./config/json-schema.js";
export { runAudit } from "./audit/engine.js";
export { explainFinding } from "./audit/registry.js";
export { renderAgentReport } from "./audit/reporters/agent.js";
export { renderHumanReport } from "./audit/reporters/human.js";
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
export { createNodeBoostMcpServer, startNodeBoostMcpServer } from "./mcp/server.js";
export { applicationInfoTool } from "./mcp/tools/application-info.js";
export { auditTool } from "./mcp/tools/audit.js";
export { doctorTool } from "./mcp/tools/doctor.js";
export { explainFindingTool } from "./mcp/tools/explain-finding.js";
export { listRoutesTool } from "./mcp/tools/list-routes.js";
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
export type { AuditFinding, AuditResult } from "./audit/rule.js";
export type { DoctorCheck, DoctorResult } from "./mcp/tools/doctor.js";

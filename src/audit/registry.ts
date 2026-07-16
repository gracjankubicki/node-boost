import type { ArchitectureSlug } from "../types.js";
import type { AuditRule, ExplainEntry } from "./rule.js";
import { auditRuleIds, auditRuleMetadata, isAuditRuleId } from "./definitions.js";
import { dataAccessLayerRules } from "./rules/data-access-layer.js";
import { errorLoadingBoundaryRules } from "./rules/error-loading-boundaries.js";
import { featureModuleRules } from "./rules/feature-modules.js";
import { modernTypeScriptRules } from "./rules/modern-typescript.js";
import { secureByDefaultRules } from "./rules/secure-by-default.js";
import { serverFirstComponentRules } from "./rules/server-first-components.js";
import { stateManagementRules } from "./rules/state-management.js";
import { typedContractRules } from "./rules/typed-contracts.js";

export const auditRules: AuditRule[] = [
  ...featureModuleRules,
  ...serverFirstComponentRules,
  ...dataAccessLayerRules,
  ...typedContractRules,
  ...stateManagementRules,
  ...errorLoadingBoundaryRules,
  ...secureByDefaultRules,
  ...modernTypeScriptRules,
];

const implementedRuleIds = new Set(auditRules.map((rule) => rule.id));
if (implementedRuleIds.size !== auditRules.length) {
  throw new Error("Audit rule implementations contain duplicate identifiers.");
}

for (const ruleId of auditRuleIds) {
  if (!implementedRuleIds.has(ruleId)) {
    throw new Error(`Audit rule ${ruleId} is registered but has no implementation.`);
  }
}

const guidelineByArchitecture: Record<ArchitectureSlug, string> = {
  "feature-modules": ".ai/guidelines/architectures/feature-modules.md",
  "server-first-components": ".ai/guidelines/architectures/server-first-components.md",
  "data-access-layer": ".ai/guidelines/architectures/data-access-layer.md",
  "typed-contracts": ".ai/guidelines/architectures/typed-contracts.md",
  "state-management": ".ai/guidelines/architectures/state-management.md",
  "custom-hooks": ".ai/guidelines/architectures/custom-hooks.md",
  "component-composition": ".ai/guidelines/architectures/component-composition.md",
  "styling-tailwind": ".ai/guidelines/architectures/styling-tailwind.md",
  "testing-strategy": ".ai/guidelines/architectures/testing-strategy.md",
  "error-loading-boundaries": ".ai/guidelines/architectures/error-loading-boundaries.md",
  "secure-by-default": ".ai/guidelines/architectures/secure-by-default.md",
  "modern-typescript": ".ai/guidelines/architectures/modern-typescript.md",
  "ui-states": ".ai/guidelines/architectures/ui-states.md",
};

export const explainEntries = new Map<string, ExplainEntry>(auditRules.map((rule) => {
  if (!isAuditRuleId(rule.id)) {
    throw new Error(`Audit implementation ${rule.id} is missing from the rule registry.`);
  }

  const metadata = auditRuleMetadata[rule.id];
  return [
    rule.id,
    {
      rule: rule.id,
      code: rule.code,
      severity: rule.defaultSeverity,
      architecture: rule.architecture,
      description: metadata.description,
      rationale: "This check enforces the selected node-boost architecture guideline and keeps generated agent feedback actionable.",
      fix: metadata.fix,
      guideline: guidelineByArchitecture[rule.architecture],
    },
  ];
}));

export function explainFinding(ruleId: string): ExplainEntry | null {
  return explainEntries.get(ruleId) ?? null;
}

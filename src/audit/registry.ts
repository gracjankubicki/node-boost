import type { ArchitectureSlug } from "../types.js";
import type { AuditRule, ExplainEntry } from "./rule.js";
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

export const explainEntries = new Map<string, ExplainEntry>(
  auditRules.map((rule) => [
    rule.id,
    {
      rule: rule.id,
      code: rule.code,
      severity: rule.defaultSeverity,
      architecture: rule.architecture,
      description: describeRule(rule.id),
      rationale: "This check enforces the selected node-boost architecture guideline and keeps generated agent feedback actionable.",
      fix: fixRule(rule.id),
      guideline: guidelineByArchitecture[rule.architecture],
    },
  ]),
);

export function explainFinding(ruleId: string): ExplainEntry | null {
  return explainEntries.get(ruleId) ?? null;
}

function describeRule(ruleId: string): string {
  const descriptions: Record<string, string> = {
    "NB-ARCH-001": "Feature modules must not deep-import internals from other features.",
    "NB-ARCH-002": "Feature modules must not depend on app/router entry layers.",
    "NB-ARCH-003": "Next page and layout entries should stay server-first.",
    "NB-ARCH-004": "Client directives should be present only when the file needs client-only behavior.",
    "NB-ARCH-005": "Client components should call a data layer or query hook instead of raw network clients.",
    "NB-ARCH-006": "Server Components should keep raw fetch calls in a data layer.",
    "NB-ARCH-007": "Untrusted JSON at data boundaries should be validated.",
    "NB-ARCH-008": "Environment access should be centralized in env files.",
    "NB-ARCH-009": "Server data should not be pushed directly into client stores.",
    "NB-ARCH-010": "Async Next app segments need loading or error boundaries.",
    "NB-ARCH-011": "Raw HTML injection and HTML parser sinks must receive approved sanitized or static content.",
    "NB-ARCH-012": "Public env names must not look like secrets.",
    "NB-ARCH-013": "TypeScript projects should run with strict mode.",
    "NB-ARCH-014": "Source code should avoid explicit any outside tests and declarations.",
  };

  return descriptions[ruleId] ?? "Unknown node-boost audit rule.";
}

function fixRule(ruleId: string): string {
  const fixes: Record<string, string> = {
    "NB-ARCH-001": "Import from the feature public index or move shared code to a shared module.",
    "NB-ARCH-002": "Invert the dependency: app imports features, features do not import app.",
    "NB-ARCH-003": "Move interactive code to a child client component.",
    "NB-ARCH-004": "Remove the directive or add a real client-only boundary around interactive code.",
    "NB-ARCH-005": "Move the request to an API/data module or wrap it in a query hook.",
    "NB-ARCH-006": "Move raw fetch usage to the configured data layer.",
    "NB-ARCH-007": "Parse the response with an invoked runtime schema; generated TypeScript types alone are not validation.",
    "NB-ARCH-008": "Read the env var in env.ts/env.mjs and import the typed value.",
    "NB-ARCH-009": "Keep server state in a query/cache layer and store only UI state.",
    "NB-ARCH-010": "Add loading.tsx or error.tsx in the segment branch.",
    "NB-ARCH-011": "Sanitize dynamic HTML with an approved imported library before passing it to a raw-HTML or parser sink.",
    "NB-ARCH-012": "Rename the public env var so it does not imply secret material.",
    "NB-ARCH-013": "Set compilerOptions.strict to true, directly or through an extends chain.",
    "NB-ARCH-014": "Replace any with a concrete, unknown, or generic type.",
  };

  return fixes[ruleId] ?? "Open the linked guideline and apply the recommended architecture boundary.";
}

import { z } from "zod";

export const auditRuleIds = [
  "NB-ARCH-001",
  "NB-ARCH-002",
  "NB-ARCH-003",
  "NB-ARCH-004",
  "NB-ARCH-005",
  "NB-ARCH-006",
  "NB-ARCH-007",
  "NB-ARCH-008",
  "NB-ARCH-009",
  "NB-ARCH-010",
  "NB-ARCH-011",
  "NB-ARCH-012",
  "NB-ARCH-013",
  "NB-ARCH-014",
] as const;

export type AuditRuleId = typeof auditRuleIds[number];

const auditRuleIdSet = new Set<string>(auditRuleIds);

export function isAuditRuleId(value: string): value is AuditRuleId {
  return auditRuleIdSet.has(value);
}

const nonEmptyStrings = z.array(z.string().min(1));
const noOptions = z.strictObject({});
const featureModuleOptions = z.strictObject({ featuresDir: z.string().min(1).optional() });
const dataLayerOptions = z.strictObject({ dataLayerGlobs: nonEmptyStrings.optional() });
const envOptions = z.strictObject({ envFiles: nonEmptyStrings.optional() });
const sanitizerOptions = z.strictObject({ sanitizers: nonEmptyStrings.optional() });

export const auditRuleOptionSchemas: Record<AuditRuleId, z.ZodType> = {
  "NB-ARCH-001": featureModuleOptions,
  "NB-ARCH-002": featureModuleOptions,
  "NB-ARCH-003": noOptions,
  "NB-ARCH-004": noOptions,
  "NB-ARCH-005": dataLayerOptions,
  "NB-ARCH-006": dataLayerOptions,
  "NB-ARCH-007": dataLayerOptions,
  "NB-ARCH-008": envOptions,
  "NB-ARCH-009": dataLayerOptions,
  "NB-ARCH-010": noOptions,
  "NB-ARCH-011": sanitizerOptions,
  "NB-ARCH-012": noOptions,
  "NB-ARCH-013": noOptions,
  "NB-ARCH-014": noOptions,
};

export const auditRuleMetadata: Record<AuditRuleId, { description: string; fix: string }> = {
  "NB-ARCH-001": {
    description: "Feature modules must not deep-import internals from other features.",
    fix: "Import from the feature public index or move shared code to a shared module.",
  },
  "NB-ARCH-002": {
    description: "Feature modules must not depend on app/router entry layers.",
    fix: "Invert the dependency: app imports features, features do not import app.",
  },
  "NB-ARCH-003": {
    description: "Next page and layout entries should stay server-first.",
    fix: "Move interactive code to a child client component.",
  },
  "NB-ARCH-004": {
    description: "Client directives should be present only when the file needs client-only behavior.",
    fix: "Remove the directive or add a real client-only boundary around interactive code.",
  },
  "NB-ARCH-005": {
    description: "Client components should call a data layer or query hook instead of raw network clients.",
    fix: "Move the request to an API/data module or wrap it in a query hook.",
  },
  "NB-ARCH-006": {
    description: "Server Components should keep raw fetch calls in a data layer.",
    fix: "Move raw fetch usage to the configured data layer.",
  },
  "NB-ARCH-007": {
    description: "Untrusted JSON at data boundaries should be validated.",
    fix: "Parse the response with a schema, or rely on a generated typed client.",
  },
  "NB-ARCH-008": {
    description: "Environment access should be centralized in env files.",
    fix: "Read the env var in env.ts/env.mjs and import the typed value.",
  },
  "NB-ARCH-009": {
    description: "Server data should not be pushed directly into client stores.",
    fix: "Keep server state in a query/cache layer and store only UI state.",
  },
  "NB-ARCH-010": {
    description: "Async Next app segments need loading or error boundaries.",
    fix: "Add loading.tsx or error.tsx in the segment branch.",
  },
  "NB-ARCH-011": {
    description: "Raw HTML injection must be sanitized or static.",
    fix: "Sanitize the HTML value before passing it to dangerouslySetInnerHTML.",
  },
  "NB-ARCH-012": {
    description: "Public env names must not look like secrets.",
    fix: "Rename the public env var so it does not imply secret material.",
  },
  "NB-ARCH-013": {
    description: "TypeScript projects should run with strict mode.",
    fix: "Set compilerOptions.strict to true, directly or through an extends chain.",
  },
  "NB-ARCH-014": {
    description: "Source code should avoid explicit any outside tests and declarations.",
    fix: "Replace any with a concrete, unknown, or generic type.",
  },
};

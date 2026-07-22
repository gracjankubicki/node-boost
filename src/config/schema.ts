import { z } from "zod";
import { auditRuleOptionSchemas, isAuditRuleId } from "../audit/definitions.js";

export const agentNameSchema = z.enum(["claude-code", "codex", "cursor"]);

export const stackNameSchema = z.enum(["next", "vite-react", "react-generic", "unknown"]);

export const architectureSlugSchema = z.enum([
  "feature-modules",
  "server-first-components",
  "data-access-layer",
  "typed-contracts",
  "state-management",
  "custom-hooks",
  "component-composition",
  "styling-tailwind",
  "testing-strategy",
  "error-loading-boundaries",
  "secure-by-default",
  "modern-typescript",
  "ui-states",
]);

const pluginPackageNameSchema = z.string().refine(isPluginPackageName, "Invalid plugin package name.");
const pluginArchitectureNameSchema = z.string().refine(isPluginArchitectureName, "Invalid plugin architecture name.");
const pluginVariantSchema = z.string().refine(isPluginSlug, "Invalid plugin variant slug.");

export const auditSeveritySchema = z.enum(["off", "warn", "err"]);

export const featureModulesBoundarySchema = z.enum(["public-api", "forbid"]);

const nonFeatureModuleArchitectureSlugSchema = z.enum([
  "server-first-components",
  "data-access-layer",
  "typed-contracts",
  "state-management",
  "custom-hooks",
  "component-composition",
  "styling-tailwind",
  "testing-strategy",
  "error-loading-boundaries",
  "secure-by-default",
  "modern-typescript",
  "ui-states",
]);

export const architectureEntrySchema = z.union([
  architectureSlugSchema,
  pluginArchitectureNameSchema,
  z.strictObject({
    name: z.literal("feature-modules"),
    boundary: featureModulesBoundarySchema.default("public-api"),
  }),
  z.strictObject({
    name: nonFeatureModuleArchitectureSlugSchema,
  }),
  z.strictObject({
    name: pluginArchitectureNameSchema,
    variant: pluginVariantSchema.optional(),
  }),
]);

const defaultFeatures = {
  guidelines: true,
  skills: true,
  mcp: true,
  architecture: true,
  hooks: false,
};

const defaultAudit = {
  exclude: [],
  rules: {},
  ruleOptions: {},
};

export const featuresSchema = z.object({
  guidelines: z.boolean().default(true),
  skills: z.boolean().default(true),
  mcp: z.boolean().default(true),
  architecture: z.boolean().default(true),
  hooks: z.boolean().default(false),
});

export const auditSchema = z
  .object({
    exclude: z.array(z.string()).default([]),
    rules: z.record(z.string(), auditSeveritySchema).default({}),
    ruleOptions: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),
  })
  .superRefine((audit, context) => {
    for (const ruleId of Object.keys(audit.rules)) {
      if (!isAuditRuleId(ruleId)) {
        context.addIssue({
          code: "custom",
          path: ["rules", ruleId],
          message: `Unknown audit rule ${ruleId}.`,
        });
      }
    }
    for (const ruleId of Object.keys(audit.ruleOptions)) {
      if (!isAuditRuleId(ruleId)) {
        context.addIssue({
          code: "custom",
          path: ["ruleOptions", ruleId],
          message: `Unknown audit rule ${ruleId}.`,
        });
        continue;
      }

      const result = auditRuleOptionSchemas[ruleId].safeParse(audit.ruleOptions[ruleId]);
      if (!result.success) {
        for (const issue of result.error.issues) {
          context.addIssue({
            code: "custom",
            path: ["ruleOptions", ruleId, ...issue.path],
            message: issue.message,
          });
        }
      }
    }
  })
  .default(defaultAudit);

export const nodeBoostConfigSchema = z.object({
  $schema: z.string().optional(),
  version: z.literal(1),
  generatedWith: z.string().min(1),
  stack: stackNameSchema,
  agents: z.array(agentNameSchema).default([]),
  hookAgents: z.array(agentNameSchema).optional(),
  plugins: z.array(pluginPackageNameSchema).optional(),
  features: featuresSchema.default(defaultFeatures),
  architectures: z.array(architectureEntrySchema).default([]),
  audit: auditSchema,
}).superRefine((config, context) => {
  for (const hookAgent of config.hookAgents ?? []) {
    if (!config.agents.includes(hookAgent)) {
      context.addIssue({
        code: "custom",
        path: ["hookAgents"],
        message: `Hook agent ${hookAgent} must also be present in agents.`,
      });
    }
  }

  const plugins = config.plugins ?? [];
  if (new Set(plugins).size !== plugins.length) {
    context.addIssue({ code: "custom", path: ["plugins"], message: "Plugin package names must be unique." });
  }

  const architectureNames = config.architectures.map((architecture) =>
    typeof architecture === "string" ? architecture : architecture.name,
  );
  if (new Set(architectureNames).size !== architectureNames.length) {
    context.addIssue({ code: "custom", path: ["architectures"], message: "Architecture names must be unique." });
  }
  for (const architectureName of architectureNames) {
    const pluginName = pluginNameFromArchitecture(architectureName);
    if (pluginName && !plugins.includes(pluginName)) {
      context.addIssue({
        code: "custom",
        path: ["architectures"],
        message: `Plugin architecture ${architectureName} requires ${pluginName} in plugins.`,
      });
    }
  }
});

export type NodeBoostConfig = z.infer<typeof nodeBoostConfigSchema>;
export type ArchitectureConfigEntry = z.infer<typeof architectureEntrySchema>;

export interface NormalizedArchitecture {
  name: string;
  options: Record<string, unknown>;
}

export function parseNodeBoostConfig(input: unknown): NodeBoostConfig {
  return nodeBoostConfigSchema.parse(input);
}

export function normalizeArchitectures(config: Pick<NodeBoostConfig, "architectures">): NormalizedArchitecture[] {
  return config.architectures.map((architecture) => {
    if (typeof architecture === "string") {
      return {
        name: architecture,
        options: architecture === "feature-modules" ? { boundary: "public-api" } : {},
      };
    }

    if (architecture.name === "feature-modules" && "boundary" in architecture) {
      return {
        name: architecture.name,
        options: { boundary: architecture.boundary },
      };
    }

    if (isPluginArchitectureName(architecture.name)) {
      return {
        name: architecture.name,
        options: "variant" in architecture && architecture.variant ? { variant: architecture.variant } : {},
      };
    }

    return {
      name: architecture.name,
      options: {},
    };
  });
}

function isPluginArchitectureName(value: string): boolean {
  const separator = value.lastIndexOf(":");
  return separator > 0
    && isPluginPackageName(value.slice(0, separator))
    && isPluginSlug(value.slice(separator + 1));
}

function pluginNameFromArchitecture(value: string): string | null {
  if (!isPluginArchitectureName(value)) {
    return null;
  }
  return value.slice(0, value.lastIndexOf(":"));
}

function isPluginPackageName(value: string): boolean {
  if (value.length === 0 || value.length > 214 || value !== value.toLowerCase()) {
    return false;
  }
  if (value.startsWith("@")) {
    const parts = value.slice(1).split("/");
    return parts.length === 2 && parts.every(isPackageSegment);
  }
  return !value.includes("/") && isPackageSegment(value);
}

function isPackageSegment(segment: string): boolean {
  return segment.length > 0
    && isLowerAlphaNumeric(segment[0])
    && [...segment].every((character) => isLowerAlphaNumeric(character) || "-._~".includes(character));
}

function isPluginSlug(value: string): boolean {
  return value.length > 0
    && isLowerAlphaNumeric(value[0])
    && isLowerAlphaNumeric(value.at(-1))
    && [...value].every((character) => isLowerAlphaNumeric(character) || character === "-");
}

function isLowerAlphaNumeric(character: string | undefined): boolean {
  return character !== undefined && ((character >= "a" && character <= "z") || (character >= "0" && character <= "9"));
}

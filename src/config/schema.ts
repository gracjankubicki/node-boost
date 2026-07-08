import { z } from "zod";

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
  z.strictObject({
    name: z.literal("feature-modules"),
    boundary: featureModulesBoundarySchema.default("public-api"),
  }),
  z.strictObject({
    name: nonFeatureModuleArchitectureSlugSchema,
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
  .default(defaultAudit);

export const nodeBoostConfigSchema = z.object({
  $schema: z.string().optional(),
  version: z.literal(1),
  generatedWith: z.string().min(1),
  stack: stackNameSchema,
  agents: z.array(agentNameSchema).default([]),
  features: featuresSchema.default(defaultFeatures),
  architectures: z.array(architectureEntrySchema).default([]),
  audit: auditSchema,
});

export type NodeBoostConfig = z.infer<typeof nodeBoostConfigSchema>;
export type ArchitectureConfigEntry = z.infer<typeof architectureEntrySchema>;

export interface NormalizedArchitecture {
  name: z.infer<typeof architectureSlugSchema>;
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

    if (architecture.name === "feature-modules") {
      return {
        name: architecture.name,
        options: { boundary: architecture.boundary },
      };
    }

    return {
      name: architecture.name,
      options: {},
    };
  });
}

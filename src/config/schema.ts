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
]);

export const auditSeveritySchema = z.enum(["off", "warn", "err"]);

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
  architectures: z.array(architectureSlugSchema).default([]),
  audit: auditSchema,
});

export type NodeBoostConfig = z.infer<typeof nodeBoostConfigSchema>;

export function parseNodeBoostConfig(input: unknown): NodeBoostConfig {
  return nodeBoostConfigSchema.parse(input);
}

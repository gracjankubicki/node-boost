import { z } from "zod";
import { auditRuleIds, auditRuleOptionSchemas } from "../audit/definitions.js";
import { nodeBoostConfigSchema } from "./schema.js";

export function createNodeBoostJsonSchema(): unknown {
  const schema = z.toJSONSchema(nodeBoostConfigSchema) as Record<string, unknown>;
  const properties = schema.properties as Record<string, unknown>;
  const audit = properties.audit as Record<string, unknown>;
  const auditProperties = audit.properties as Record<string, unknown>;
  const rules = auditProperties.rules as Record<string, unknown>;
  const ruleOptions = auditProperties.ruleOptions as Record<string, unknown>;

  rules.propertyNames = { type: "string", enum: [...auditRuleIds] };
  ruleOptions.properties = Object.fromEntries(auditRuleIds.map((ruleId) => {
    const optionSchema = z.toJSONSchema(auditRuleOptionSchemas[ruleId]) as Record<string, unknown>;
    const nestedSchema = { ...optionSchema };
    delete nestedSchema.$schema;
    return [ruleId, nestedSchema];
  }));
  ruleOptions.additionalProperties = false;
  delete ruleOptions.propertyNames;

  return {
    ...schema,
    $id: "https://node-boost.dev/schema.json",
    title: "node-boost configuration",
  };
}

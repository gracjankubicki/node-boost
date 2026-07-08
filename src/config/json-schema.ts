import { z } from "zod";
import { nodeBoostConfigSchema } from "./schema.js";

export function createNodeBoostJsonSchema(): unknown {
  const schema = z.toJSONSchema(nodeBoostConfigSchema);

  return {
    ...schema,
    $id: "https://node-boost.dev/schema.json",
    title: "node-boost configuration",
  };
}

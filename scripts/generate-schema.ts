import { writeFile } from "node:fs/promises";
import { createNodeBoostJsonSchema } from "../src/config/json-schema.js";

const schemaPath = new URL("../schema.json", import.meta.url);
const schema = createNodeBoostJsonSchema();

await writeFile(schemaPath, `${JSON.stringify(schema, null, 2)}\n`, "utf8");

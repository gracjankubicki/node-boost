import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createNodeBoostJsonSchema } from "../../src/config/json-schema.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("schema.json", () => {
  it("matches the JSON Schema generated from zod", async () => {
    const schemaPath = join(repoRoot, "schema.json");
    const schema: unknown = JSON.parse(await readFile(schemaPath, "utf8"));

    expect(schema).toEqual(createNodeBoostJsonSchema());
  });
});

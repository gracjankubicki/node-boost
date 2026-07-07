import { describe, expect, it } from "vitest";
import { parseNodeBoostConfig } from "../../src/config/schema.js";

describe("nodeBoostConfigSchema", () => {
  it("parses a valid config with defaults", () => {
    const config = parseNodeBoostConfig({
      version: 1,
      generatedWith: "0.1.0",
      stack: "next",
    });

    expect(config.features.guidelines).toBe(true);
    expect(config.features.hooks).toBe(false);
    expect(config.agents).toEqual([]);
    expect(config.audit.exclude).toEqual([]);
  });

  it("rejects an invalid config", () => {
    expect(() =>
      parseNodeBoostConfig({
        version: 2,
        generatedWith: "",
        stack: "rails",
      }),
    ).toThrow();
  });
});

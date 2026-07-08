import { describe, expect, it } from "vitest";
import {
  normalizeArchitectures,
  parseNodeBoostConfig,
} from "../../src/config/schema.js";

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

  it("parses the 13 architecture slugs", () => {
    const config = parseNodeBoostConfig({
      version: 1,
      generatedWith: "0.1.0",
      stack: "next",
      architectures: [
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
      ],
    });

    expect(config.architectures).toHaveLength(13);
  });

  it("normalizes string and object architecture entries", () => {
    const stringConfig = parseNodeBoostConfig({
      version: 1,
      generatedWith: "0.1.0",
      stack: "next",
      architectures: ["feature-modules", "secure-by-default"],
    });

    const objectConfig = parseNodeBoostConfig({
      version: 1,
      generatedWith: "0.1.0",
      stack: "next",
      architectures: [{ name: "feature-modules" }, { name: "secure-by-default" }],
    });

    expect(normalizeArchitectures(stringConfig)).toEqual(normalizeArchitectures(objectConfig));
  });

  it("preserves feature-modules boundary variants", () => {
    const config = parseNodeBoostConfig({
      version: 1,
      generatedWith: "0.1.0",
      stack: "next",
      architectures: [{ name: "feature-modules", boundary: "forbid" }],
    });

    expect(normalizeArchitectures(config)).toEqual([
      { name: "feature-modules", options: { boundary: "forbid" } },
    ]);
  });

  it("rejects invalid architecture variants", () => {
    expect(() =>
      parseNodeBoostConfig({
        version: 1,
        generatedWith: "0.1.0",
        stack: "next",
        architectures: ["server-actions-everywhere"],
      }),
    ).toThrow();

    expect(() =>
      parseNodeBoostConfig({
        version: 1,
        generatedWith: "0.1.0",
        stack: "next",
        architectures: [{ name: "feature-modules", boundary: "strict" }],
      }),
    ).toThrow();

    expect(() =>
      parseNodeBoostConfig({
        version: 1,
        generatedWith: "0.1.0",
        stack: "next",
        architectures: [{ name: "secure-by-default", boundary: "forbid" }],
      }),
    ).toThrow();
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

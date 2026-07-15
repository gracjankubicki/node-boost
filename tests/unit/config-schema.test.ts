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

  it("parses explicit content plugins and namespaced architecture variants", () => {
    const config = parseNodeBoostConfig({
      version: 1,
      generatedWith: "0.2.0",
      stack: "vite-react",
      plugins: ["@acme/node-boost-plugin"],
      architectures: [
        { name: "@acme/node-boost-plugin:service-layer", variant: "strict" },
      ],
    });

    expect(normalizeArchitectures(config)).toEqual([
      { name: "@acme/node-boost-plugin:service-layer", options: { variant: "strict" } },
    ]);
  });

  it("requires plugin architectures to reference a unique configured package", () => {
    expect(() => parseNodeBoostConfig({
      version: 1,
      generatedWith: "0.2.0",
      stack: "next",
      plugins: ["@acme/plugin", "@acme/plugin"],
      architectures: ["@other/plugin:service-layer"],
    })).toThrow();
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

    expect(() =>
      parseNodeBoostConfig({
        version: 1,
        generatedWith: "0.1.0",
        stack: "next",
        agents: ["codex"],
        hookAgents: ["cursor"],
      }),
    ).toThrow("must also be present in agents");
  });
});

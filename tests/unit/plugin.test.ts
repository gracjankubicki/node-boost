import { describe, expect, it } from "vitest";
import { defineNodeBoostPlugin } from "../../src/plugin/index.js";

describe("defineNodeBoostPlugin", () => {
  it("defines a minimal content-only plugin", () => {
    const plugin = defineNodeBoostPlugin({
      apiVersion: 1,
      name: "@acme/node-boost-architecture",
      architectures: [
        {
          slug: "service-layer",
          title: "Service layer",
          stacks: ["next", "vite-react"],
          resources: {
            guideline: "resources/service-layer/guideline.md",
            skill: "resources/service-layer/SKILL.md",
            variants: {
              strict: {
                guideline: "resources/service-layer/strict.md",
              },
            },
          },
        },
      ],
    });

    expect(plugin.name).toBe("@acme/node-boost-architecture");
    expect(plugin.architectures[0]?.slug).toBe("service-layer");
    expect(Object.keys(plugin).sort()).toEqual(["apiVersion", "architectures", "name"]);
  });

  it.each([
    ["invalid plugin package", { apiVersion: 1, name: "Bad Package", architectures: [architecture("valid")] }],
    ["invalid architecture slug", { apiVersion: 1, name: "@acme/plugin", architectures: [architecture("Invalid_Slug")] }],
    ["duplicate architecture slug", {
      apiVersion: 1,
      name: "@acme/plugin",
      architectures: [architecture("duplicate"), architecture("duplicate")],
    }],
    ["resource traversal", {
      apiVersion: 1,
      name: "@acme/plugin",
      architectures: [architecture("unsafe", "../outside.md")],
    }],
    ["executable rules", {
      apiVersion: 1,
      name: "@acme/plugin",
      architectures: [{ ...architecture("unsafe"), rules: [() => undefined] }],
    }],
  ])("rejects %s", (_label, input) => {
    expect(() => defineNodeBoostPlugin(input as never)).toThrowError();
  });
});

function architecture(slug: string, guideline = `resources/${slug}/guideline.md`) {
  return {
    slug,
    title: "Architecture",
    stacks: ["next"] as const,
    resources: {
      guideline,
      skill: `resources/${slug}/SKILL.md`,
    },
  };
}

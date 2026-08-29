import { describe, expect, it } from "vitest";
import { parseAstroSource } from "../../src/astro/source.js";

describe("parseAstroSource", () => {
  it("returns frontmatter, client and server islands, and set:html sinks", async () => {
    const document = await parseAstroSource([
      "---",
      'import Counter from "../components/Counter.tsx";',
      "const schema = { name: 'Example' };",
      "---",
      "<main>",
      "  <Counter client:visible />",
      "  <Account server:defer><p slot=\"fallback\">Loading</p></Account>",
      '  <script type="application/ld+json" set:html={JSON.stringify(schema)} />',
      "</main>",
      "",
    ].join("\n"));

    expect(document.frontmatter).toContain("import Counter");
    expect(document.frontmatterLineOffset).toBe(0);
    expect(document.islands).toEqual([
      expect.objectContaining({ component: "Counter", directive: "client:visible", kind: "client" }),
      expect.objectContaining({ component: "Account", directive: "server:defer", kind: "server" }),
    ]);
    expect(document.htmlSinks).toEqual([
      expect.objectContaining({ tag: "script", expression: "JSON.stringify(schema)", kind: "expression" }),
    ]);
    expect(document.diagnostics).not.toContainEqual(expect.objectContaining({ severity: 1 }));
  });
});

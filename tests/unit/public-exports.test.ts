import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as pluginApi from "../../src/plugin/index.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("0.2.0 package exports", () => {
  it("publishes only the dedicated plugin subpath", async () => {
    const packageJson = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8")) as {
      exports: Record<string, unknown>;
    };

    expect(Object.keys(packageJson.exports).sort()).toEqual(["./plugin"]);
  });
});

describe("plugin public runtime exports", () => {
  it("exposes only the approved constructor", () => {
    expect(Object.keys(pluginApi).sort()).toEqual(["defineNodeBoostPlugin"]);
  });
});

import { defineConfig } from "tsup";
import packageJson from "./package.json" with { type: "json" };

const external = Object.keys(packageJson.dependencies);

export default defineConfig([
  {
    entry: { plugin: "src/plugin/index.ts" },
    format: ["esm"],
    dts: true,
    clean: true,
    sourcemap: true,
    target: "node20",
    external,
  },
  {
    entry: { cli: "src/cli/index.ts" },
    format: ["esm"],
    dts: false,
    clean: false,
    sourcemap: true,
    target: "node20",
    external,
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
]);

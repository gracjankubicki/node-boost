import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import node from "@astrojs/node";
import react from "@astrojs/react";

export default defineConfig({
  // Static by default, with account.astro opting into on-demand rendering.
  output: "static",
  adapter: node({ mode: "standalone" }),
  integrations: [react(), mdx()],
});

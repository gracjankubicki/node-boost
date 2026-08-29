import { defineConfig } from "astro/config";
import lit from "@astrojs/lit";
import mdx from "@astrojs/mdx";
import preact from "@astrojs/preact";
import react from "@astrojs/react";
import solid from "@astrojs/solid-js";
import svelte from "@astrojs/svelte";
import vue from "@astrojs/vue";

export default defineConfig({
  output: "static",
  integrations: [react(), preact(), vue(), svelte(), solid(), lit(), mdx()],
});

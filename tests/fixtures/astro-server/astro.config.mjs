import { defineConfig, envField, memoryCache, sessionDrivers } from "astro/config";
import node from "@astrojs/node";

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  cache: {
    provider: memoryCache(),
  },
  routeRules: {
    "/api/**": { maxAge: 60 },
    "/dashboard": { maxAge: 0 },
  },
  env: {
    schema: {
      API_URL: envField.string({
        context: "server",
        access: "public",
        default: "https://api.example.test",
      }),
      API_SECRET: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
    },
  },
  session: {
    driver: sessionDrivers.lruCache({ max: 128 }),
  },
  i18n: {
    defaultLocale: "en",
    locales: ["en", "pl"],
    routing: "prefix-other-locales",
  },
});

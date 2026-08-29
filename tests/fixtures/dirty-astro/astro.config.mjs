import { defineConfig, envField } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  output: "static",
  integrations: [react()],
  env: {
    schema: {
      PUBLIC_DATABASE_PASSWORD: envField.string({
        context: "client",
        access: "public",
        optional: true,
      }),
      INTERNAL_TOKEN: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
    },
  },
});

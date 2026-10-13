import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
    // Install tests write the vendored skill trees; Windows filesystem I/O is far slower than Linux.
    testTimeout: process.platform === "win32" ? 30_000 : 5_000,
  },
});

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["examples/**/*.test.ts"],
    setupFiles: ["./vitest.setup-env.mjs"],
  },
});

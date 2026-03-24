import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "packages/runtime/vitest.config.ts",
      "packages/clients/vitest.config.ts",
      "packages/scenarios/vitest.config.ts",
      "packages/examples/vitest.config.ts",
    ],
  },
});

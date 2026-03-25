import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const packageDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Make all `test.include` / `coverage.include` globs resolve relative to this package,
  // even when Vitest is executed from the monorepo root.
  root: packageDir,
  // Coverage must live under `test.coverage`. A root-level `coverage` key is not wired into
  // Vitest's coverage provider, so include/exclude would not filter the report.
  test: {
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    setupFiles: ["dotenv/config"],
    coverage: {
      all: false,
      provider: "v8",
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        // Docs build artifacts (generated under the monorepo root).
        "**/docs/**",
        "**/coverage/**",
        "**/examples/**",
        "**/*.types.ts",
        "**/*.typespec.ts",
      ],
    },
  },
});

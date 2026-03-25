import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

const packageDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(packageDir, "../..");

export default defineConfig(({ mode }) => ({
  // Monorepo `.env` at repo root (cwd when running from packages/examples is not the root).
  envDir: repoRoot,
  test: {
    include: ["examples/**/*.test.ts"],
    // Package-local `.env` overrides root (same merge order as Vitest: vite env, then test.env).
    env: loadEnv(mode, packageDir),
  },
}));

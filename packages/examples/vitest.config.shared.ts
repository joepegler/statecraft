import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

const packageDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(packageDir, "../..");

export function examplesVitestConfig(options: { linkLocalCore: boolean }) {
  const alias: Record<string, string> = {
    viem: resolve(repoRoot, "node_modules/viem"),
  };
  if (options.linkLocalCore) {
    alias["@st8craft/core"] = resolve(repoRoot, "packages/core/src/index.ts");
  }

  return defineConfig(({ mode }) => ({
    envDir: repoRoot,
    resolve: { alias },
    test: {
      include: ["examples/**/*.test.ts"],
      env: loadEnv(mode, packageDir),
    },
  }));
}

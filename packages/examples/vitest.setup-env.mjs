import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(packageDir, "../..");

// dotenv/config only reads process.cwd()/.env, so a repo-root .env is missed when
// tests run from packages/examples. Load root first, then package-local overrides.
config({ path: resolve(repoRoot, ".env") });
config({ path: resolve(packageDir, ".env") });

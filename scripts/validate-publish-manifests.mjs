#!/usr/bin/env node
/**
 * Packs each publishable @st8craft package and fails if any packed manifest
 * still contains workspace: protocol in dependency fields.
 * Optionally runs a consumer smoke install using file: tarballs and npm overrides
 * (no registry needed for @st8craft packages).
 */
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const PUBLISH_PACKAGES = [
  "packages/runtime",
  "packages/clients",
  "packages/scenarios",
  "packages/vitest",
];

const SKIP_SMOKE = process.env.ST8CRAFT_SKIP_CONSUMER_SMOKE === "1";

function listWorkspaceDeps(pkg) {
  const out = [];
  for (const field of [
    "dependencies",
    "peerDependencies",
    "optionalDependencies",
    "devDependencies",
  ]) {
    const obj = pkg[field];
    if (!obj || typeof obj !== "object") continue;
    for (const [name, spec] of Object.entries(obj)) {
      if (typeof spec === "string" && spec.startsWith("workspace:")) {
        out.push({ field, name, spec });
      }
    }
  }
  return out;
}

function packToDir(pkgDir, destDir) {
  execFileSync("npm", ["pack", "--pack-destination", destDir], {
    cwd: pkgDir,
    stdio: "pipe",
  });
  const files = readdirSync(destDir).filter((f) => f.endsWith(".tgz"));
  if (files.length !== 1) {
    throw new Error(
      `Expected exactly one .tgz in ${destDir}, got: ${files.join(", ") || "(none)"}`,
    );
  }
  return join(destDir, files[0]);
}

function readPackedManifest(tgzPath, extractBase) {
  const extractDir = mkdtempSync(join(extractBase, "extract-"));
  execFileSync("tar", ["-xzf", tgzPath, "-C", extractDir, "package/package.json"], {
    stdio: "pipe",
  });
  const manifestPath = join(extractDir, "package", "package.json");
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

/** @param {string} tgzPath */
function tarballListsPath(tgzPath, entryPath) {
  const out = execFileSync("tar", ["-tzf", tgzPath], { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  return out.split("\n").some((line) => line === entryPath || line === `${entryPath}/`);
}

function runConsumerSmoke(tarballsByName, tmpRoot) {
  const smokeDir = join(tmpRoot, "consumer-smoke");
  mkdirSync(smokeDir, { recursive: true });

  const vitestTgz = tarballsByName["@st8craft/vitest"];
  if (!vitestTgz) throw new Error("Missing @st8craft/vitest tarball path");

  const pkgJson = {
    name: "st8craft-consumer-smoke",
    private: true,
    type: "module",
    dependencies: {
      "@st8craft/vitest": `file:${vitestTgz}`,
    },
    overrides: {
      "@st8craft/scenarios": `file:${tarballsByName["@st8craft/scenarios"]}`,
      "@st8craft/clients": `file:${tarballsByName["@st8craft/clients"]}`,
      "@st8craft/runtime": `file:${tarballsByName["@st8craft/runtime"]}`,
    },
  };

  writeFileSync(join(smokeDir, "package.json"), `${JSON.stringify(pkgJson, null, 2)}\n`);
  console.log("Running consumer smoke: npm install + import @st8craft/vitest");
  execFileSync("npm", ["install"], { cwd: smokeDir, stdio: "inherit" });
  execFileSync(
    "node",
    [
      "--input-type=module",
      "-e",
      "import('@st8craft/vitest').then(() => console.log('consumer smoke: import ok'))",
    ],
    { cwd: smokeDir, stdio: "inherit" },
  );
}

const tmpRoot = mkdtempSync(join(tmpdir(), "st8craft-publish-val-"));
try {
  /** @type {Record<string, string>} */
  const tarballsByName = {};

  for (const rel of PUBLISH_PACKAGES) {
    const pkgDir = join(root, rel);
    const sourceManifest = JSON.parse(
      readFileSync(join(pkgDir, "package.json"), "utf8"),
    );
    const packDir = mkdtempSync(join(tmpRoot, "pack-"));
    const tgzPath = packToDir(pkgDir, packDir);
    const packed = readPackedManifest(tgzPath, tmpRoot);
    const bad = listWorkspaceDeps(packed);
    if (bad.length > 0) {
      console.error(`${rel}: packed manifest still contains workspace: protocol:`);
      for (const b of bad) {
        console.error(`  ${b.field}["${b.name}"]: ${b.spec}`);
      }
      process.exitCode = 1;
      process.exit(1);
    }
    console.log(`OK packed manifest: ${sourceManifest.name} (${rel})`);
    tarballsByName[sourceManifest.name] = tgzPath;
  }

  if (!SKIP_SMOKE) {
    const vitestTgz = tarballsByName["@st8craft/vitest"];
    if (!tarballListsPath(vitestTgz, "package/dist/index.js")) {
      console.error(
        "Packed @st8craft/vitest tarball is missing package/dist/index.js.\n" +
          "Ensure each package lists \"files\": [\"dist\", ...] in package.json (dist/ is gitignored),\n" +
          "and run `bun run build` before validate-publish-manifests.",
      );
      process.exit(1);
    }
    runConsumerSmoke(tarballsByName, tmpRoot);
  } else {
    console.log("Skipping consumer smoke (ST8CRAFT_SKIP_CONSUMER_SMOKE=1)");
  }

  console.log("validate-publish-manifests: all checks passed");
} finally {
  rmSync(tmpRoot, { recursive: true, force: true });
}

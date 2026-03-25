import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const PACKAGE_NAME = "@st8craft/vitest";

function run(command, args, cwd) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: false,
    });

    child.on("error", rejectPromise);
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(
        new Error(`${command} ${args.join(" ")} failed with code ${code ?? "unknown"}`),
      );
    });
  });
}

const currentFile = fileURLToPath(import.meta.url);
const scriptDir = dirname(currentFile);
const examplesDir = resolve(scriptDir, "..");
const repoRoot = resolve(examplesDir, "..", "..");
const examplesPackageJsonPath = resolve(examplesDir, "package.json");

const requestedVersion = process.argv[2] ?? "latest";
const npmSpecifier = `npm:${PACKAGE_NAME}@${requestedVersion}`;

const packageJsonRaw = await readFile(examplesPackageJsonPath, "utf8");
const packageJson = JSON.parse(packageJsonRaw);
const originalSpecifier = packageJson.dependencies?.[PACKAGE_NAME];

if (!originalSpecifier) {
  throw new Error(
    `Missing ${PACKAGE_NAME} in ${examplesPackageJsonPath}. Add it to dependencies first.`,
  );
}

packageJson.dependencies[PACKAGE_NAME] = npmSpecifier;
await writeFile(examplesPackageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

console.log(`Temporarily set ${PACKAGE_NAME} -> ${npmSpecifier}`);

let restoreFailed = false;

try {
  await run("bun", ["install"], repoRoot);
  await run("bun", ["--filter", "@st8craft/examples", "test"], repoRoot);
} finally {
  try {
    const restoreRaw = await readFile(examplesPackageJsonPath, "utf8");
    const restoreJson = JSON.parse(restoreRaw);
    restoreJson.dependencies[PACKAGE_NAME] = originalSpecifier;
    await writeFile(examplesPackageJsonPath, `${JSON.stringify(restoreJson, null, 2)}\n`, "utf8");
    console.log(`Restored ${PACKAGE_NAME} -> ${originalSpecifier}`);
    await run("bun", ["install"], repoRoot);
  } catch (error) {
    restoreFailed = true;
    console.error("Failed to restore local workspace dependency state.");
    console.error(error);
  }
}

if (restoreFailed) {
  process.exit(1);
}

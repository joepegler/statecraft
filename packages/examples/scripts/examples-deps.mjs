import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

export const SDK_PACKAGE = "@st8craft/core";
export const WORKSPACE_SPEC = "workspace:*";

/** @param {string} fromImportMetaUrl */
export function getExamplesPaths(fromImportMetaUrl) {
  const currentFile = fileURLToPath(fromImportMetaUrl);
  const scriptDir = dirname(currentFile);
  const examplesDir = resolve(scriptDir, "..");
  const repoRoot = resolve(examplesDir, "..", "..");
  const packageJsonPath = resolve(examplesDir, "package.json");
  return { examplesDir, repoRoot, packageJsonPath };
}

/** @param {string} packageJsonPath */
export async function readExamplesPackageJson(packageJsonPath) {
  const raw = await readFile(packageJsonPath, "utf8");
  return JSON.parse(raw);
}

/** @param {string} packageJsonPath @param {object} pkg */
export async function writeExamplesPackageJson(packageJsonPath, pkg) {
  await writeFile(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}

/** @param {string | undefined} version e.g. "0.1.3" or "latest" */
export function sdkSpecifierForPublished(version) {
  const v = version ?? "latest";
  return `npm:${SDK_PACKAGE}@${v}`;
}

/** @param {object} pkg @param {string} specifier */
export function setSdkDependency(pkg, specifier) {
  if (!pkg.dependencies?.[SDK_PACKAGE]) {
    throw new Error(
      `Missing ${SDK_PACKAGE} in examples package.json dependencies. Add it first.`,
    );
  }
  pkg.dependencies[SDK_PACKAGE] = specifier;
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {string} cwd
 */
export function runCommand(command, args, cwd) {
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

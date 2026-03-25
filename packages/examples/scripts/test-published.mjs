import {
  VITEST_PACKAGE,
  getExamplesPaths,
  readExamplesPackageJson,
  writeExamplesPackageJson,
  vitestSpecifierForPublished,
  setVitestDependency,
  runCommand,
} from "./examples-deps.mjs";

const { repoRoot, packageJsonPath } = getExamplesPaths(import.meta.url);
const requestedVersion = process.argv[2] ?? "latest";
const npmSpecifier = vitestSpecifierForPublished(requestedVersion);

const packageJson = await readExamplesPackageJson(packageJsonPath);
const originalSpecifier = packageJson.dependencies?.[VITEST_PACKAGE];

if (!originalSpecifier) {
  throw new Error(
    `Missing ${VITEST_PACKAGE} in ${packageJsonPath}. Add it to dependencies first.`,
  );
}

setVitestDependency(packageJson, npmSpecifier);
await writeExamplesPackageJson(packageJsonPath, packageJson);

console.log(`Temporarily set ${VITEST_PACKAGE} -> ${npmSpecifier}`);

let restoreFailed = false;

try {
  await runCommand("bun", ["install"], repoRoot);
  await runCommand("bun", ["--filter", "@st8craft/examples", "test"], repoRoot);
} finally {
  try {
    const restoreJson = await readExamplesPackageJson(packageJsonPath);
    restoreJson.dependencies[VITEST_PACKAGE] = originalSpecifier;
    await writeExamplesPackageJson(packageJsonPath, restoreJson);
    console.log(`Restored ${VITEST_PACKAGE} -> ${originalSpecifier}`);
    await runCommand("bun", ["install"], repoRoot);
  } catch (error) {
    restoreFailed = true;
    console.error("Failed to restore local workspace dependency state.");
    console.error(error);
  }
}

if (restoreFailed) {
  process.exit(1);
}

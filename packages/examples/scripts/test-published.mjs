import {
  SDK_PACKAGE,
  getExamplesPaths,
  readExamplesPackageJson,
  writeExamplesPackageJson,
  sdkSpecifierForPublished,
  setSdkDependency,
  runCommand,
} from "./examples-deps.mjs";

const { repoRoot, packageJsonPath } = getExamplesPaths(import.meta.url);
const requestedVersion = process.argv[2] ?? "latest";
const npmSpecifier = sdkSpecifierForPublished(requestedVersion);

const packageJson = await readExamplesPackageJson(packageJsonPath);
const originalSpecifier = packageJson.dependencies?.[SDK_PACKAGE];

if (!originalSpecifier) {
  throw new Error(
    `Missing ${SDK_PACKAGE} in ${packageJsonPath}. Add it to dependencies first.`,
  );
}

setSdkDependency(packageJson, npmSpecifier);
await writeExamplesPackageJson(packageJsonPath, packageJson);

console.log(`Temporarily set ${SDK_PACKAGE} -> ${npmSpecifier}`);

let restoreFailed = false;

try {
  await runCommand("bun", ["install"], repoRoot);
  await runCommand("bun", ["--filter", "@st8craft/examples", "test"], repoRoot);
} finally {
  try {
    const restoreJson = await readExamplesPackageJson(packageJsonPath);
    restoreJson.dependencies[SDK_PACKAGE] = originalSpecifier;
    await writeExamplesPackageJson(packageJsonPath, restoreJson);
    console.log(`Restored ${SDK_PACKAGE} -> ${originalSpecifier}`);
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

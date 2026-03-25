import {
  WORKSPACE_SPEC,
  SDK_PACKAGE,
  getExamplesPaths,
  readExamplesPackageJson,
  writeExamplesPackageJson,
  sdkSpecifierForPublished,
  setSdkDependency,
  runCommand,
} from "./examples-deps.mjs";

const argv = process.argv.slice(2).filter((a) => a !== "--no-install");
const noInstall = process.argv.includes("--no-install");
const [mode, versionArg] = argv;

if (mode !== "local" && mode !== "published") {
  console.error(
    "Usage: node scripts/set-examples-deps.mjs <local|published> [npmVersion] [--no-install]",
  );
  console.error("");
  console.error("  local              use workspace:* (monorepo packages)");
  console.error("  published [ver]    use npm registry (default ver: latest)");
  console.error("  --no-install       only edit package.json, skip bun install");
  process.exit(1);
}

const { repoRoot, packageJsonPath } = getExamplesPaths(import.meta.url);
const pkg = await readExamplesPackageJson(packageJsonPath);
const specifier =
  mode === "local" ? WORKSPACE_SPEC : sdkSpecifierForPublished(versionArg);
setSdkDependency(pkg, specifier);
await writeExamplesPackageJson(packageJsonPath, pkg);
console.log(`Set ${SDK_PACKAGE} -> ${specifier}`);

if (!noInstall) {
  await runCommand("bun", ["install"], repoRoot);
}

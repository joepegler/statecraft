import { createServer } from "node:net";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { spawn, type ChildProcessByStdio } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import type { Address } from "viem";
import { StatecraftError } from "../errors.js";

export type StartBundlerResult = {
  bundlerUrl: string;
  stop: () => Promise<void>;
};

const DEFAULT_EXECUTOR_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const DEFAULT_UTILITY_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

// These addresses match Alto's local config and are deployed deterministically by its local assumptions.
const ENTRYPOINT_V06 = "0x0000000071727De22E5E9d8BAf0edAc6f37da032" as const;
const ENTRYPOINT_V07 = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789" as const;
const ENTRYPOINT_SIMULATION_CONTRACT_V7 = "0xBbe8A301FbDb2a4CD58c4A37c262ecef8f889c47" as const;

function getAvailablePort(): Promise<number> {
  const server = createServer();
  return new Promise((resolvePort, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === "string") {
          reject(new StatecraftError({
            code: "SC_RUNTIME_PORT_ALLOCATION_FAILED",
            reason: "Failed to allocate a local port for bundler.",
            suggestedAction: "Retry startup or free local ports before starting the bundler.",
          }));
          return;
        }
        resolvePort(address.port);
      });
    });
  });
}

async function writeAltoConfigFile(args: {
  configDir: string;
  rpcUrl: string;
  port: number;
  // Keep both v0.6 and v0.7 to maximize out-of-the-box compatibility.
  entryPoint: Address;
}): Promise<string> {
  // We intentionally keep the config aligned with Alto's default local config shape,
  // overriding only RPC, port, and entrypoints. This minimizes the risk of missing required keys.
  const config = {
    "network-name": "local",
    "rpc-url": args.rpcUrl,
    "min-entity-stake": 1,
    "min-executor-balance": "1000000000000000000",
    "min-entity-unstake-delay": 1,
    "max-bundle-wait": 3,
    "max-bundle-size": 3,
    port: args.port,
    "executor-private-keys": DEFAULT_EXECUTOR_PRIVATE_KEY,
    "utility-private-key": DEFAULT_UTILITY_PRIVATE_KEY,
    // Include the full set; Alto supports both entrypoint versions locally.
    entrypoints: `${ENTRYPOINT_V06},${ENTRYPOINT_V07}`,
    // Simulation contract used by Alto for v0.7 entrypoints.
    "entrypoint-simulation-contract-v7": ENTRYPOINT_SIMULATION_CONTRACT_V7,
    "enable-debug-endpoints": true,
    "expiration-check": false,
    "safe-mode": false,
    "api-version": "v1,v2",
    // Used for debugging only; kept to mirror local config.
    "public-client-log-level": "info",
  } as const;

  const configPath = join(args.configDir, "alto-config.json");
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf8");
  void args.entryPoint; // reserved for future: could narrow entrypoints in config
  return configPath;
}

function resolveAltoCliPath(): string {
  const require = createRequire(import.meta.url);

  // Prefer ESM resolution since Alto's bin points at `esm/cli/alto.js`.
  // When `import.meta.resolve` is unavailable, fall back to package.json location.
  let resolved: string;
  try {
    resolved =
      typeof (import.meta as any).resolve === "function"
        ? (import.meta as any).resolve("@pimlico/alto")
        : require.resolve("@pimlico/alto");
  } catch (err) {
    // This runs in the host project's context, so module resolution failures usually mean the consumer
    // did not install Alto, even though `withBundler({ mode: "alto" })` expects it.
    const message =
      `withBundler({ mode: "alto" }) requires "@pimlico/alto" to be installed in your project. ` +
      `Install it (for example, \`bun add -D @pimlico/alto\`) and ensure it is resolvable from your test runner.`;
    throw new StatecraftError({
      code: "SC_PRECONDITION_FAILED",
      reason: message,
      suggestedAction: "Install @pimlico/alto as a dev dependency and re-run tests.",
      cause: err,
    });
  }

  const resolvedPath = resolved.startsWith("file:")
    ? fileURLToPath(resolved)
    : resolved;
  const pkgDir = dirname(resolvedPath); // .../esm (package "import" entry)
  // `package.json` bin is `./esm/cli/alto.js`, next to the resolved module dir.
  const cliPath = resolve(pkgDir, "cli/alto.js");
  return cliPath;
}

async function waitForListening(process: ChildProcessByStdio<null, any, any>, timeoutMs: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for Alto to start (>${timeoutMs}ms).`));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timeout);
      process.stdout?.off("data", onStdout);
      process.stderr?.off("data", onStderr);
    }

    const onStdout = (chunk: Buffer) => {
      const text = chunk.toString();
      if (text.includes("Server listening at")) {
        cleanup();
        resolve();
      }
    };

    const onStderr = (chunk: Buffer) => {
      const text = chunk.toString();
      // Alto emits some noisy logs; only hard-fail on obvious fatal startup errors.
      if (text.includes("Error") || text.includes("FATAL")) {
        cleanup();
        reject(new Error(text.trim()));
      }
    };

    process.stdout?.on("data", onStdout);
    process.stderr?.on("data", onStderr);
    process.once("exit", (code, signal) => {
      cleanup();
      reject(new Error(`Alto exited during startup (code: ${code}, signal: ${signal}).`));
    });
  });
}

async function waitForBundlerJsonRpcReady(args: { bundlerUrl: string; timeoutMs: number }): Promise<void> {
  const startedAt = Date.now();
  let lastError: string | undefined;
  while (Date.now() - startedAt < args.timeoutMs) {
    let controllerTimeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const controller = new AbortController();
      controllerTimeout = setTimeout(() => controller.abort(), 500);
      const response = await fetch(args.bundlerUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_supportedEntryPoints",
          params: [],
        }),
      });
      clearTimeout(controllerTimeout);
      if (response.ok) {
        const payload = await response.json() as { result?: unknown; error?: unknown };
        if (payload.result !== undefined) {
          return;
        }
        if (payload.error !== undefined) {
          lastError = JSON.stringify(payload.error);
        }
      } else {
        lastError = `HTTP ${response.status}`;
      }
    } catch (error) {
      if (controllerTimeout) clearTimeout(controllerTimeout);
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new StatecraftError({
    code: "SC_BUNDLER_START_FAILED",
    reason: "Bundler JSON-RPC endpoint did not become ready in time.",
    context: {
      bundlerUrl: args.bundlerUrl,
      timeoutMs: args.timeoutMs,
      lastError,
    },
    suggestedAction: "Inspect Alto startup logs and config for startup issues.",
  });
}

export async function startBundler(args: {
  rpcUrl: string;
  entryPoint: Address;
  // Optional stable id could be wired later into temp dirs.
  startupTimeoutMs?: number;
}): Promise<StartBundlerResult> {
  const port = await getAvailablePort();
  const bundlerUrl = `http://127.0.0.1:${port}`;

  const configDir = await mkdtemp(join(tmpdir(), "statecraft-alto-"));
  const configPath = await writeAltoConfigFile({
    configDir,
    rpcUrl: args.rpcUrl,
    port,
    entryPoint: args.entryPoint,
  });

  const altoCli = resolveAltoCliPath();
  const child = spawn("node", [altoCli, "--config", configPath], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await waitForListening(child, args.startupTimeoutMs ?? 12_000);
    await waitForBundlerJsonRpcReady({
      bundlerUrl,
      timeoutMs: args.startupTimeoutMs ?? 12_000,
    });
  } catch (err) {
    child.kill("SIGTERM");
    await rm(configDir, { recursive: true, force: true });
    throw new StatecraftError({
      code: "SC_BUNDLER_START_FAILED",
      reason: "Failed to start local bundler.",
      context: {
        bundlerUrl,
        configPath,
      },
      suggestedAction: "Verify @pimlico/alto is installed and check startup stderr output.",
      cause: err,
    });
  }

  let stopped = false;
  return {
    bundlerUrl,
    async stop() {
      if (stopped) return;
      stopped = true;
      child.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        let exited = false;
        child.once("exit", () => {
          exited = true;
          resolve();
        });

        setTimeout(() => {
          if (exited) return resolve();
          // Escalate to avoid leaked processes when Alto ignores SIGTERM.
          child.kill("SIGKILL");
          resolve();
        }, 3_000).unref();
      });
      await rm(configDir, { recursive: true, force: true });
    },
  };
}


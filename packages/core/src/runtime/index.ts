import { createServer } from "node:net";
import { randomUUID } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { StatecraftError } from "../scenarios/errors.js";

/** How anvil is started: empty chain or fork from a remote RPC. */
export type RuntimeMode = "chain" | "fork";

/** Input to {@link createRuntime} / {@link startRuntime}; `rpcUrl` and `blockNumber` are required when `mode` is `"fork"`. */
export type RuntimeConfig = {
  mode: RuntimeMode;
  /** Remote HTTP RPC when forking; omit for `"chain"` mode. */
  rpcUrl?: string;
  /** Fork block pin; required for `"fork"` in this version. */
  blockNumber?: bigint;
  /** Forwarded to anvil `--chain-id` when set. */
  chainId?: number;
  /** Correlation id; assigned by {@link createRuntime} when omitted. */
  key?: string;
};

/** Live process handle: JSON-RPC URL and idempotent shutdown. */
export type RuntimeHandle = {
  /** Same as `RuntimeConfig.key` after normalization. */
  key: string;
  /** Base URL of the anvil HTTP server (e.g. `http://127.0.0.1:<port>`). */
  rpcUrl: string;
  /** Terminates the anvil child process; safe to call multiple times. */
  stop(): Promise<void>;
};

type InternalRuntimeState = {
  child: ChildProcessWithoutNullStreams;
  stopped: boolean;
};

const runtimeState = new WeakMap<RuntimeHandle, InternalRuntimeState>();

function assertForkConfig(config: RuntimeConfig): asserts config is RuntimeConfig & { mode: "fork"; rpcUrl: string; blockNumber: bigint } {
  if (!config.rpcUrl) {
    throw new StatecraftError({
      code: "SC_PRECONDITION_FAILED",
      reason: "withFork/startRuntime requires rpcUrl for fork mode.",
      suggestedAction: "Provide a valid rpcUrl when mode is 'fork'.",
    });
  }

  if (config.blockNumber === undefined) {
    throw new StatecraftError({
      code: "SC_PRECONDITION_FAILED",
      reason: "withFork/startRuntime requires a pinned blockNumber in v1 for deterministic forks.",
      suggestedAction: "Set blockNumber to a bigint literal (for example 22_000_000n).",
    });
  }
}

async function getAvailablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new StatecraftError({
      code: "SC_RUNTIME_PORT_ALLOCATION_FAILED",
      reason: "Failed to allocate a local port for runtime.",
      suggestedAction: "Retry startup or free local ports before starting a runtime.",
    });
  }
  const port = address.port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

async function waitForJsonRpcReady(args: { rpcUrl: string; timeoutMs: number }): Promise<void> {
  const startedAt = Date.now();
  let lastError: string | undefined;
  while (Date.now() - startedAt < args.timeoutMs) {
    let controllerTimeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const controller = new AbortController();
      controllerTimeout = setTimeout(() => controller.abort(), 500);
      const response = await fetch(args.rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "web3_clientVersion",
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
    code: "SC_RUNTIME_START_TIMEOUT",
    reason: "Runtime JSON-RPC endpoint did not become ready in time.",
    context: {
      rpcUrl: args.rpcUrl,
      timeoutMs: args.timeoutMs,
      lastError,
    },
    suggestedAction: "Inspect startup logs and ensure anvil can bind and answer JSON-RPC requests.",
  });
}

/**
 * Validates fork config and ensures `RuntimeConfig.key` (defaults to a new UUID).
 * Does not start anvil; use {@link startRuntime} for that.
 */
export function createRuntime(config: RuntimeConfig): RuntimeConfig {
  if (config.mode === "fork") {
    assertForkConfig(config);
  }

  return {
    ...config,
    key: config.key ?? randomUUID(),
  };
}

/**
 * Spawns `anvil` on an ephemeral port, waits until it listens, and returns a {@link RuntimeHandle}.
 */
export async function startRuntime(input: RuntimeConfig): Promise<RuntimeHandle> {
  const config = createRuntime(input);
  const port = await getAvailablePort();
  const rpcUrl = `http://127.0.0.1:${port}`;

  const args = ["--host", "127.0.0.1", "--port", String(port)];

  if (config.chainId !== undefined) {
    args.push("--chain-id", String(config.chainId));
  }

  if (config.mode === "fork") {
    assertForkConfig(config);
    args.push("--fork-url", config.rpcUrl, "--fork-block-number", config.blockNumber.toString());
  }

  const child = spawn("anvil", args, { stdio: "pipe" });

  const diagnostics = {
    mode: config.mode,
    port,
    args,
    stderrTail: [] as string[],
  };
  const onData = (chunk: Buffer) => {
    const text = chunk.toString();
    diagnostics.stderrTail.push(text.trim());
    if (diagnostics.stderrTail.length > 20) {
      diagnostics.stderrTail.shift();
    }
  };
  child.stdout.on("data", onData);
  child.stderr.on("data", onData);

  const startupFailure = new Promise<never>((_, reject) => {
    child.once("error", (error) => {
      reject(new StatecraftError({
        code: "SC_RUNTIME_START_FAILED",
        reason: `Failed to start anvil runtime: ${error.message}`,
        context: diagnostics,
        suggestedAction: "Verify anvil is executable and runtime args are valid.",
        cause: error,
      }));
    });
    child.once("exit", (code, signal) => {
      reject(new StatecraftError({
        code: "SC_RUNTIME_START_FAILED",
        reason: `Anvil exited during startup (code: ${String(code)}, signal: ${String(signal)}).`,
        context: {
          ...diagnostics,
          exitCode: code,
          signal,
        },
        suggestedAction: "Inspect anvil startup logs and validate your fork config.",
      }));
    });
  });

  try {
    await Promise.race([
      waitForJsonRpcReady({
        rpcUrl,
        timeoutMs: 12_000,
      }),
      startupFailure,
    ]);
  } catch (error) {
    child.kill("SIGTERM");
    throw error;
  }

  const handle: RuntimeHandle = {
    key: config.key!,
    rpcUrl,
    async stop() {
      const state = runtimeState.get(handle);
      if (!state || state.stopped) {
        return;
      }
      state.stopped = true;
      await new Promise<void>((resolve) => {
        state.child.once("exit", () => resolve());
        state.child.kill("SIGTERM");
        setTimeout(() => resolve(), 3_000).unref();
      });
    },
  };

  runtimeState.set(handle, { child, stopped: false });

  return handle;
}

/** Convenience alias for `handle.stop()`. */
export async function stopRuntime(handle: RuntimeHandle): Promise<void> {
  await handle.stop();
}

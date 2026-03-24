import { createServer } from "node:net";
import { randomUUID } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

export type RuntimeMode = "chain" | "fork";

export type RuntimeConfig = {
  mode: RuntimeMode;
  rpcUrl?: string;
  blockNumber?: bigint;
  chainId?: number;
  key?: string;
};

export type RuntimeHandle = {
  key: string;
  rpcUrl: string;
  stop(): Promise<void>;
};

type InternalRuntimeState = {
  child: ChildProcessWithoutNullStreams;
  stopped: boolean;
};

const runtimeState = new WeakMap<RuntimeHandle, InternalRuntimeState>();

function assertForkConfig(config: RuntimeConfig): asserts config is RuntimeConfig & { mode: "fork"; rpcUrl: string; blockNumber: bigint } {
  if (!config.rpcUrl) {
    throw new Error("withFork/startRuntime requires rpcUrl for fork mode.");
  }

  if (config.blockNumber === undefined) {
    throw new Error("withFork/startRuntime requires a pinned blockNumber in v1 for deterministic forks.");
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
    throw new Error("Failed to allocate a local port for runtime.");
  }
  const port = address.port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

export function createRuntime(config: RuntimeConfig): RuntimeConfig {
  if (config.mode === "fork") {
    assertForkConfig(config);
  }

  return {
    ...config,
    key: config.key ?? randomUUID(),
  };
}

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

  let startError: Error | undefined;
  const startup = await new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => {
      startError = new Error("Timed out waiting for anvil to start. Ensure `anvil` is installed and on PATH.");
      resolve(false);
    }, 12_000);

    const onData = (chunk: Buffer) => {
      const text = chunk.toString();
      if (text.includes("Listening on")) {
        clearTimeout(timeout);
        resolve(true);
      }
    };

    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.once("error", (error) => {
      clearTimeout(timeout);
      startError = new Error(`Failed to start anvil runtime: ${error.message}`);
      resolve(false);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timeout);
      startError = new Error(`Anvil exited during startup (code: ${String(code)}, signal: ${String(signal)}).`);
      resolve(false);
    });
  });

  if (!startup) {
    child.kill("SIGTERM");
    throw startError ?? new Error("Failed to start runtime.");
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

export async function stopRuntime(handle: RuntimeHandle): Promise<void> {
  await handle.stop();
}

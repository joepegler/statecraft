import { startRuntime, stopRuntime } from "../../runtime/index.js";
import { createClients } from "../../clients/index.js";
import type { EmptyScenarioContext, ScenarioRuntimeClientsContext, ScenarioStep } from "../types.js";

/** Options for an anvil instance forked from a remote JSON-RPC endpoint at a pinned block. */
export type WithForkConfig = {
  /** HTTP(S) RPC URL of the chain to fork (passed to anvil `--fork-url`). */
  rpcUrl: string;
  /**
   * Block number to pin the fork (`--fork-block-number`); required for deterministic scenarios.
   */
  blockNumber: bigint;
  /** Optional anvil `--chain-id` override. */
  chainId?: number;
  /** Stable id forwarded to `RuntimeConfig.key` on the runtime package. */
  key?: string;
};

/**
 * Middleware: starts a forked anvil, wires viem clients, runs `next`, then stops the runtime.
 */
export function withFork(config: WithForkConfig): ScenarioStep<EmptyScenarioContext, ScenarioRuntimeClientsContext> {
  return async (ctx, next) => {
    if (!config.rpcUrl) {
      throw new Error("withFork(...) requires rpcUrl.");
    }

    if (config.blockNumber === undefined) {
      throw new Error("withFork(...) requires a pinned blockNumber in v1.");
    }

    const runtime = await startRuntime({
      mode: "fork",
      rpcUrl: config.rpcUrl,
      blockNumber: config.blockNumber,
      ...(config.chainId !== undefined ? { chainId: config.chainId } : {}),
      ...(config.key !== undefined ? { key: config.key } : {}),
    });
    const clients = createClients(runtime, config.chainId !== undefined ? { chainId: config.chainId } : {});

    try {
      await next({
        ...ctx,
        runtime,
        publicClient: clients.publicClient,
        walletClient: clients.walletClient,
        testClient: clients.testClient,
      });
    } finally {
      await stopRuntime(runtime);
    }
  };
}

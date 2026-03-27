import { startRuntime, stopRuntime } from "../../runtime/index.js";
import { createClients } from "../../clients/index.js";
import type { ScenarioContext, ScenarioRuntimeClientsContext, ScenarioStep } from "../types.js";

/** Options for starting a fresh chain (non-fork) anvil instance. */
export type WithChainConfig = {
  /**
   * Key on `ctx.chains` for this runtime (default `default`).
   */
  chainKey?: string;
  /** Anvil `--chain-id` when set; defaults match runtime/clients package defaults. */
  chainId?: number;
  /** Stable id forwarded to `RuntimeConfig.key` on the runtime package for correlation across restarts. */
  key?: string;
};

/**
 * Middleware: starts an empty-chain anvil, wires viem clients under `ctx.chains[chainKey]`, runs `next`, then stops the runtime.
 */
export function withChain(config: WithChainConfig = {}): ScenarioStep<ScenarioContext, ScenarioRuntimeClientsContext> {
  const chainKey = config.chainKey ?? "default";
  return async (ctx, next) => {
    const runtime = await startRuntime({
      mode: "chain",
      ...(config.chainId !== undefined ? { chainId: config.chainId } : {}),
      ...(config.key !== undefined ? { key: config.key } : {}),
    });
    const clients = createClients(runtime, config.chainId !== undefined ? { chainId: config.chainId } : {});

    try {
      await next({
        ...ctx,
        chains: {
          ...(ctx.chains ?? {}),
          [chainKey]: {
            runtime,
            runtimeMode: "chain",
            chain: clients.publicClient.chain,
            publicClient: clients.publicClient,
            walletClient: clients.walletClient,
            testClient: clients.testClient,
          },
        },
      });
    } finally {
      await stopRuntime(runtime);
    }
  };
}

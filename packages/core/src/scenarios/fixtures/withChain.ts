import { startRuntime, stopRuntime } from "../../runtime/index.js";
import { createClients } from "../../clients/index.js";
import type { ScenarioChainContext, ScenarioContext, ScenarioRuntimeClientsContext, ScenarioStep } from "../types.js";
import { assertTwoChainLimit, resolvePublicClientAliases, type PublicClientAliasPolicy } from "../utils.js";
import { labelScenarioStep } from "../stepMeta.js";

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
  /** Policy for deriving top-level `publicClient`/`altPublicClient` aliases from `ctx.chains`. */
  publicClientAliasPolicy?: PublicClientAliasPolicy;
};

/**
 * Middleware: starts an empty-chain anvil, wires viem clients under `ctx.chains[chainKey]`, runs `next`, then stops the runtime.
 */
export function withChain(config: WithChainConfig = {}): ScenarioStep<ScenarioContext, ScenarioRuntimeClientsContext> {
  const chainKey = config.chainKey ?? "default";
  return labelScenarioStep(async (ctx, next) => {
    const runtime = await startRuntime({
      mode: "chain",
      ...(config.chainId !== undefined ? { chainId: config.chainId } : {}),
      ...(config.key !== undefined ? { key: config.key } : {}),
    });
    const clients = createClients(runtime, config.chainId !== undefined ? { chainId: config.chainId } : {});
    const chainContext: ScenarioChainContext = {
      runtime,
      runtimeMode: "chain",
      chain: clients.publicClient.chain,
      publicClient: clients.publicClient,
      walletClient: clients.walletClient,
      testClient: clients.testClient,
    };
    const chains: Record<string, ScenarioChainContext> = {
      ...(ctx.chains ?? {}),
      [chainKey]: chainContext,
    };
    assertTwoChainLimit(chains);
    const { publicClient, altPublicClient } = resolvePublicClientAliases(chains, config.publicClientAliasPolicy);

    try {
      await next({
        ...ctx,
        chains,
        publicClient,
        altPublicClient,
      });
    } finally {
      await stopRuntime(runtime);
    }
  }, "withChain");
}

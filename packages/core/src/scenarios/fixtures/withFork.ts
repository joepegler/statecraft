import { startRuntime, stopRuntime } from "../../runtime/index.js";
import { createClients } from "../../clients/index.js";
import type { ScenarioChainContext, ScenarioContext, ScenarioRuntimeClientsContext, ScenarioStep } from "../types.js";
import { assertTwoChainLimit, resolvePublicClientAliases, type PublicClientAliasPolicy } from "../utils.js";
import { StatecraftError } from "../errors.js";
import { labelScenarioStep } from "../stepMeta.js";

/** Options for an anvil instance forked from a remote JSON-RPC endpoint at a pinned block. */
export type WithForkConfig = {
  /**
   * Key on `ctx.chains` for this runtime (default `default`).
   */
  chainKey?: string;
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
  /** Policy for deriving top-level `publicClient`/`altPublicClient` aliases from `ctx.chains`. */
  publicClientAliasPolicy?: PublicClientAliasPolicy;
};

/**
 * Middleware: starts a forked anvil, wires viem clients under `ctx.chains[chainKey]`, runs `next`, then stops the runtime.
 */
export function withFork(config: WithForkConfig): ScenarioStep<ScenarioContext, ScenarioRuntimeClientsContext> {
  const chainKey = config.chainKey ?? "default";
  return labelScenarioStep(async (ctx, next) => {
    if (!config.rpcUrl) {
      throw new StatecraftError({
        code: "SC_PRECONDITION_FAILED",
        reason: "withFork(...) requires rpcUrl.",
        suggestedAction: "Set a non-empty rpcUrl when configuring withFork(...).",
      });
    }

    if (config.blockNumber === undefined) {
      throw new StatecraftError({
        code: "SC_PRECONDITION_FAILED",
        reason: "withFork(...) requires a pinned blockNumber in v1.",
        suggestedAction: "Set blockNumber to a bigint literal for deterministic forks.",
      });
    }

    const runtime = await startRuntime({
      mode: "fork",
      rpcUrl: config.rpcUrl,
      blockNumber: config.blockNumber,
      ...(config.chainId !== undefined ? { chainId: config.chainId } : {}),
      ...(config.key !== undefined ? { key: config.key } : {}),
    });
    const clients = createClients(runtime, config.chainId !== undefined ? { chainId: config.chainId } : {});
    const chainContext: ScenarioChainContext = {
      runtime,
      runtimeMode: "fork",
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
  }, "withFork");
}

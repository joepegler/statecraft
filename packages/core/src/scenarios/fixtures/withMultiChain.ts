import { createClients, type CreateClientsOptions } from "../../clients/index.js";
import { startRuntime, stopRuntime, type RuntimeHandle, type RuntimeMode } from "../../runtime/index.js";
import type { ScenarioChainContext, ScenarioContext, ScenarioRuntimeClientsContext, ScenarioStep } from "../types.js";
import { assertTwoChainLimit, resolvePublicClientAliases, type PublicClientAliasPolicy } from "../utils.js";
import { StatecraftError } from "../errors.js";
import { labelScenarioStep } from "../stepMeta.js";

/**
 * One chain entry for {@link withMultiChain}: either a fresh chain, a pinned fork, or an external runtime.
 */
export type WithMultiChainEntry =
  | {
      type: "chain";
      /** Anvil `--chain-id` when set. */
      chainId?: number;
      /** Stable id forwarded to `RuntimeConfig.key`. */
      key?: string;
    }
  | {
      type: "fork";
      /** HTTP(S) RPC URL of the chain to fork. */
      rpcUrl: string;
      /** Pinned fork block (required). */
      blockNumber: bigint;
      chainId?: number;
      key?: string;
    }
  | {
      type: "external";
      runtime: RuntimeHandle;
      runtimeMode?: RuntimeMode;
      clients?: CreateClientsOptions;
    };

/**
 * Map of chain key → chain spec. Keys become `ctx.chains.<key>`.
 */
export type WithMultiChainConfig = Record<string, WithMultiChainEntry>;
export type WithMultiChainOptions = {
  /** Policy for deriving top-level `publicClient`/`altPublicClient` aliases from `ctx.chains`. */
  publicClientAliasPolicy?: PublicClientAliasPolicy;
};

/**
 * Middleware: starts or attaches multiple chain runtimes, wires viem clients under `ctx.chains`, runs `next`,
 * then stops only runtimes this fixture started (external entries are not stopped).
 */
export function withMultiChain(
  config: WithMultiChainConfig,
  options: WithMultiChainOptions = {},
): ScenarioStep<ScenarioContext, ScenarioRuntimeClientsContext> {
  return labelScenarioStep(async (ctx, next) => {
    const keys = Object.keys(config);
    if (keys.length === 0) {
      throw new StatecraftError({
        code: "SC_PRECONDITION_FAILED",
        reason: "withMultiChain(...) requires at least one chain entry.",
        suggestedAction: "Provide one or two chain entries.",
      });
    }
    if (keys.length > 2) {
      throw new StatecraftError({
        code: "SC_CONSTRAINT_VIOLATION",
        reason: "withMultiChain(...) supports at most two chain entries.",
        context: { chainCount: keys.length },
        suggestedAction: "Split this workflow into separate scenarios.",
      });
    }

    const sortedKeys = [...keys].sort();
    const owned: RuntimeHandle[] = [];
    const chains: Record<string, ScenarioChainContext> = { ...(ctx.chains ?? {}) };

    let pipelineError: unknown;
    try {
      for (const key of sortedKeys) {
        const entry = config[key];
        if (!entry) {
          continue;
        }
        if (chains[key]) {
          throw new StatecraftError({
            code: "SC_CONSTRAINT_VIOLATION",
            reason: `withMultiChain(...) duplicate chain key "${key}".`,
            context: { chainKey: key },
            suggestedAction: "Ensure each chain key is unique.",
          });
        }

        if (entry.type === "chain") {
          const runtime = await startRuntime({
            mode: "chain",
            ...(entry.chainId !== undefined ? { chainId: entry.chainId } : {}),
            ...(entry.key !== undefined ? { key: entry.key } : {}),
          });
          owned.push(runtime);
          const clients = createClients(runtime, entry.chainId !== undefined ? { chainId: entry.chainId } : {});
          chains[key] = {
            runtime,
            runtimeMode: "chain",
            chain: clients.publicClient.chain,
            publicClient: clients.publicClient,
            walletClient: clients.walletClient,
            testClient: clients.testClient,
          };
        } else if (entry.type === "fork") {
          if (!entry.rpcUrl) {
            throw new StatecraftError({
              code: "SC_PRECONDITION_FAILED",
              reason: `withMultiChain(...) chain "${key}" (fork) requires rpcUrl.`,
              context: { chainKey: key },
              suggestedAction: "Provide rpcUrl for fork entries.",
            });
          }
          if (entry.blockNumber === undefined) {
            throw new StatecraftError({
              code: "SC_PRECONDITION_FAILED",
              reason: `withMultiChain(...) chain "${key}" (fork) requires a pinned blockNumber.`,
              context: { chainKey: key },
              suggestedAction: "Provide pinned blockNumber for deterministic fork entries.",
            });
          }
          const runtime = await startRuntime({
            mode: "fork",
            rpcUrl: entry.rpcUrl,
            blockNumber: entry.blockNumber,
            ...(entry.chainId !== undefined ? { chainId: entry.chainId } : {}),
            ...(entry.key !== undefined ? { key: entry.key } : {}),
          });
          owned.push(runtime);
          const clients = createClients(runtime, entry.chainId !== undefined ? { chainId: entry.chainId } : {});
          chains[key] = {
            runtime,
            runtimeMode: "fork",
            chain: clients.publicClient.chain,
            publicClient: clients.publicClient,
            walletClient: clients.walletClient,
            testClient: clients.testClient,
          };
        } else {
          const clients = createClients(entry.runtime, entry.clients);
          chains[key] = {
            runtime: entry.runtime,
            runtimeMode: entry.runtimeMode ?? "chain",
            chain: clients.publicClient.chain,
            publicClient: clients.publicClient,
            walletClient: clients.walletClient,
            testClient: clients.testClient,
          };
        }
      }

      assertTwoChainLimit(chains);
      const { publicClient, altPublicClient } = resolvePublicClientAliases(chains, options.publicClientAliasPolicy);
      await next({
        ...ctx,
        chains,
        publicClient,
        altPublicClient,
      });
    } catch (error) {
      pipelineError = error;
    } finally {
      const teardownErrors: unknown[] = [];
      for (const handle of owned.reverse()) {
        try {
          await stopRuntime(handle);
        } catch (error) {
          teardownErrors.push(error);
        }
      }

      const errors = [...(pipelineError ? [pipelineError] : []), ...teardownErrors];
      if (errors.length === 1) {
        throw errors[0];
      }
      if (errors.length > 1) {
        throw new AggregateError(errors, "withMultiChain(...) failed and one or more runtimes also failed to stop.");
      }
    }
  }, "withMultiChain");
}

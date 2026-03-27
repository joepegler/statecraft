import { createClients, type CreateClientsOptions } from "../../clients/index.js";
import { startRuntime, stopRuntime, type RuntimeHandle, type RuntimeMode } from "../../runtime/index.js";
import type { ScenarioChainContext, ScenarioContext, ScenarioRuntimeClientsContext, ScenarioStep } from "../types.js";

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

/**
 * Middleware: starts or attaches multiple chain runtimes, wires viem clients under `ctx.chains`, runs `next`,
 * then stops only runtimes this fixture started (external entries are not stopped).
 */
export function withMultiChain(config: WithMultiChainConfig): ScenarioStep<ScenarioContext, ScenarioRuntimeClientsContext> {
  return async (ctx, next) => {
    const keys = Object.keys(config);
    if (keys.length === 0) {
      throw new Error("withMultiChain(...) requires at least one chain entry.");
    }

    const sortedKeys = [...keys].sort();
    const owned: RuntimeHandle[] = [];
    const chains: Record<string, ScenarioChainContext> = { ...(ctx.chains ?? {}) };

    try {
      for (const key of sortedKeys) {
        const entry = config[key];
        if (!entry) {
          continue;
        }
        if (chains[key]) {
          throw new Error(`withMultiChain(...) duplicate chain key "${key}".`);
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
            throw new Error(`withMultiChain(...) chain "${key}" (fork) requires rpcUrl.`);
          }
          if (entry.blockNumber === undefined) {
            throw new Error(`withMultiChain(...) chain "${key}" (fork) requires a pinned blockNumber.`);
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

      await next({
        ...ctx,
        chains,
      });
    } finally {
      for (const handle of owned.reverse()) {
        await stopRuntime(handle);
      }
    }
  };
}

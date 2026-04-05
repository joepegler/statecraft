import { getContract, type Hex } from "viem";
import type {
  AfterSetCodeContext,
  ContractArtifact,
  ScenarioContracts,
  ScenarioRuntimeClientsContext,
  ScenarioStep,
} from "../types.js";
import { extractBytecode, requireChainScopedRuntimeClients } from "../utils.js";

/**
 * Injects bytecode at a fixed address and optionally exposes a viem contract client on context.
 */
export type ContractInjection = {
  /** Artifact supplying ABI and `deployedBytecode` (required for `setCode`). */
  artifact: ContractArtifact;
  /** Address where runtime bytecode is installed (must match your test/fork expectations). */
  address: Hex;
  /**
   * Optional hook after bytecode is set (e.g. seed storage); receives the same clients as the scenario.
   */
  afterSetCode?: (ctx: AfterSetCodeContext) => Promise<void>;
};

/**
 * Contract injections for {@link withContracts}. Use `chain` to select `ctx.chains[chain]` (default `default`).
 */
export type WithContractsConfig = {
  chain?: string;
  contracts: Record<string, ContractInjection>;
};

type WithContractsIn = ScenarioRuntimeClientsContext;
type WithContractsOut = ScenarioRuntimeClientsContext;

/**
 * Middleware: for each entry, `setCode` at `address`, then merge contract handles into `ctx.chains[chain].contracts`.
 * Requires a prior runtime fixture for that chain.
 */
export function withContracts(
  config: WithContractsConfig,
): ScenarioStep<WithContractsIn, WithContractsOut> {
  const chainKey = config.chain ?? "default";
  return async (ctx, next) => {
    requireChainScopedRuntimeClients(ctx, chainKey);
    const ch = ctx.chains[chainKey]!;
    const contracts: ScenarioContracts = { ...(ch.contracts ?? {}) };

    for (const [name, entry] of Object.entries(config.contracts)) {
      const bytecode = extractBytecode(
        entry.artifact.deployedBytecode,
        `${name}.deployedBytecode`,
      );
      await ch.testClient.setCode({
        address: entry.address,
        bytecode,
      });

      contracts[name] = entry.artifact.abi
        ? getContract({
            address: entry.address,
            abi: entry.artifact.abi as never,
            client: { public: ch.publicClient, wallet: ch.walletClient },
          })
        : { address: entry.address };

      if (entry.afterSetCode) {
        await entry.afterSetCode({
          chain: chainKey,
          name,
          address: entry.address,
          testClient: ch.testClient,
          publicClient: ch.publicClient,
          walletClient: ch.walletClient,
        });
      }
    }

    await next({
      ...ctx,
      chains: {
        ...ctx.chains,
        [chainKey]: {
          ...ch,
          contracts,
        },
      },
    });
  };
}

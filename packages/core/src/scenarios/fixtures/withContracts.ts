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

/** Contract map accepted by {@link withContracts}. */
export type WithContractsMap = Record<string, ContractInjection>;

/**
 * Contract injections for {@link withContracts}. Supports both legacy and scoped forms:
 * - legacy: `withContracts({ token: { ... } })`
 * - scoped: `withContracts({ chain: "mainnet", contracts: { token: { ... } } })`
 */
export type WithContractsConfig =
  | WithContractsMap
  | {
  chain?: string;
  contracts: WithContractsMap;
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
  const { chainKey, contracts: contractMap } = normalizeWithContractsConfig(config);
  return async (ctx, next) => {
    requireChainScopedRuntimeClients(ctx, chainKey);
    const ch = ctx.chains[chainKey]!;
    const contracts: ScenarioContracts = { ...(ch.contracts ?? {}) };

    for (const [name, entry] of Object.entries(contractMap)) {
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

function normalizeWithContractsConfig(config: WithContractsConfig): { chainKey: string; contracts: WithContractsMap } {
  const maybeScoped = config as {
    chain?: string;
    contracts?: unknown;
  };
  if (maybeScoped.contracts && typeof maybeScoped.contracts === "object") {
    const maybeLegacyContractsKey = maybeScoped.contracts as { artifact?: unknown; address?: unknown };
    const isLegacyContractsEntry = "artifact" in maybeLegacyContractsKey || "address" in maybeLegacyContractsKey;
    if (!isLegacyContractsEntry) {
      return {
        chainKey: maybeScoped.chain ?? "default",
        contracts: maybeScoped.contracts as WithContractsMap,
      };
    }
  }

  return {
    chainKey: "default",
    contracts: config as WithContractsMap,
  };
}

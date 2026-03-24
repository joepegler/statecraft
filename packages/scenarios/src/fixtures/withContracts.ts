import { getContract, type Hex } from "viem";
import type {
  AfterSetCodeContext,
  ContractArtifact,
  ScenarioContracts,
  ScenarioRuntimeClientsContext,
  ScenarioStep,
} from "../types";
import { extractBytecode, requireRuntimeClients } from "../utils";

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
 * Map of contract name → injection spec; names become keys on `ctx.contracts`.
 */
export type WithContractsConfig = Record<string, ContractInjection>;

type WithContractsIn = ScenarioRuntimeClientsContext & { contracts?: ScenarioContracts };
type WithContractsOut = ScenarioRuntimeClientsContext & { contracts: ScenarioContracts };

/**
 * Middleware: for each entry, `setCode` at `address`, then merge contract handles into `ctx.contracts`.
 * Requires a prior `withChain` / `withFork` (runtime + clients).
 */
export function withContracts(config: WithContractsConfig): ScenarioStep<WithContractsIn, WithContractsOut> {
  return async (ctx, next) => {
    requireRuntimeClients(ctx);
    const contracts: ScenarioContracts = { ...(ctx.contracts ?? {}) };

    for (const [name, entry] of Object.entries(config)) {
      const bytecode = extractBytecode(entry.artifact.deployedBytecode, `${name}.deployedBytecode`);
      await ctx.testClient.setCode({
        address: entry.address,
        bytecode,
      });

      contracts[name] = entry.artifact.abi
        ? getContract({
            address: entry.address,
            abi: entry.artifact.abi as never,
            client: { public: ctx.publicClient, wallet: ctx.walletClient },
          })
        : { address: entry.address };

      if (entry.afterSetCode) {
        await entry.afterSetCode({
          name,
          address: entry.address,
          testClient: ctx.testClient,
          publicClient: ctx.publicClient,
          walletClient: ctx.walletClient,
        });
      }
    }

    await next({
      ...ctx,
      contracts,
    });
  };
}

import { getContract, type Hex } from "viem";
import type { ContractArtifact, ScenarioContracts, ScenarioStep } from "../types";
import { extractBytecode, requireRuntimeClients } from "../utils";

export type ContractInjection = {
  artifact: ContractArtifact;
  address: Hex;
  afterSetCode?: (ctx: {
    name: string;
    address: Hex;
    testClient: NonNullable<Parameters<ScenarioStep>[0]["testClient"]>;
    publicClient: NonNullable<Parameters<ScenarioStep>[0]["publicClient"]>;
    walletClient: NonNullable<Parameters<ScenarioStep>[0]["walletClient"]>;
  }) => Promise<void>;
};

export type WithContractsConfig = Record<string, ContractInjection>;

export function withContracts(config: WithContractsConfig): ScenarioStep {
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

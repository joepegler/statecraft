import { getContract } from "viem";
import type { ContractArtifact, DeploymentRecord, ScenarioStep } from "../types";
import { extractBytecode, requireRuntimeClients } from "../utils";

type ArgsResolver = (ctx: {
  deployments: Record<string, DeploymentRecord>;
}) => readonly unknown[] | Promise<readonly unknown[]>;

export type DeploymentSpec = {
  artifact: ContractArtifact;
  args?: readonly unknown[] | ArgsResolver;
  afterDeploy?: (ctx: {
    name: string;
    deployment: DeploymentRecord;
    deployments: Record<string, DeploymentRecord>;
    wallet: string | undefined;
  }) => Promise<void>;
};

export type WithDeploymentsConfig = Record<string, DeploymentSpec>;

export function withDeployments(config: WithDeploymentsConfig): ScenarioStep {
  return async (ctx, next) => {
    requireRuntimeClients(ctx);
    const deployments: Record<string, DeploymentRecord> = { ...(ctx.deployments ?? {}) };

    for (const [name, spec] of Object.entries(config)) {
      if (!spec.artifact.abi) {
        throw new Error(`${name}.artifact.abi is required for deployment.`);
      }

      const bytecode = extractBytecode(spec.artifact.bytecode, `${name}.bytecode`);
      const args = typeof spec.args === "function" ? await spec.args({ deployments }) : spec.args ?? [];
      const account = ctx.walletClient.account;
      if (!account) {
        throw new Error("withDeployments(...) requires a walletClient account.");
      }

      const hash = await ctx.walletClient.deployContract({
        abi: spec.artifact.abi as never,
        bytecode,
        args: args as readonly unknown[],
        account,
      });

      const receipt = await ctx.publicClient.waitForTransactionReceipt({ hash });
      const deployment: DeploymentRecord = {
        address: receipt.contractAddress!,
        receipt,
        contract: getContract({
          address: receipt.contractAddress!,
          abi: spec.artifact.abi as never,
          client: { public: ctx.publicClient, wallet: ctx.walletClient },
        }),
      };

      deployments[name] = deployment;

      if (spec.afterDeploy) {
        await spec.afterDeploy({
          name,
          deployment,
          deployments,
          wallet: ctx.wallet,
        });
      }
    }

    await next({
      ...ctx,
      deployments,
    });
  };
}

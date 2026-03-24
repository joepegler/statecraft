import { getContract } from "viem";
import type {
  AfterDeployContext,
  ContractArtifact,
  DeploymentArgsResolver,
  DeploymentRecord,
  ScenarioStep,
} from "../types";
import { extractBytecode, requireRuntimeClients } from "../utils";

/**
 * Declares one contract to deploy via `walletClient.deployContract` in declaration order.
 */
export type DeploymentSpec = {
  /** Artifact with required `abi` and creation `bytecode`. */
  artifact: ContractArtifact;
  /** Static constructor args, or a resolver that may depend on earlier deployments. */
  args?: readonly unknown[] | DeploymentArgsResolver;
  /** Optional hook after the deployment is mined and merged into `deployments`. */
  afterDeploy?: (ctx: AfterDeployContext) => Promise<void>;
};

/**
 * Map of deployment name → spec; names become keys on `ctx.deployments`.
 */
export type WithDeploymentsConfig = Record<string, DeploymentSpec>;

/**
 * Middleware: deploys each spec in key order, then merges `DeploymentRecord`s into `ctx.deployments`.
 * Requires a prior `withChain` / `withFork` and a wallet account on `walletClient`.
 */
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

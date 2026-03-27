import { getContract } from "viem";
import type {
  AfterDeployContext,
  ContractArtifact,
  DeploymentArgsResolver,
  DeploymentRecord,
  ScenarioRuntimeClientsContext,
  ScenarioStep,
} from "../types.js";
import { extractBytecode, requireChainScopedRuntimeClients } from "../utils.js";

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
 * Deployments for {@link withDeployments}. Use `chain` to select `ctx.chains[chain]` (default `default`).
 */
export type WithDeploymentsConfig = {
  chain?: string;
  deployments: Record<string, DeploymentSpec>;
};

type DeploymentsMap = Record<string, DeploymentRecord>;

/**
 * Middleware: deploys each spec in key order on `ctx.chains[chain]`, then merges `DeploymentRecord`s into that chain entry.
 * Requires a prior runtime fixture and a wallet account on `walletClient` for that chain.
 */
export function withDeployments<C extends ScenarioRuntimeClientsContext>(
  config: WithDeploymentsConfig,
): ScenarioStep<
  C & { chains: C["chains"] },
  C & { chains: C["chains"] }
> {
  const chainKey = config.chain ?? "default";
  return async (ctx, next) => {
    requireChainScopedRuntimeClients(ctx, chainKey);
    const ch = ctx.chains[chainKey]!;
    const deployments: DeploymentsMap = { ...(ch.deployments ?? {}) };

    for (const [name, spec] of Object.entries(config.deployments)) {
      if (!spec.artifact.abi) {
        throw new Error(`${name}.artifact.abi is required for deployment.`);
      }

      const bytecode = extractBytecode(spec.artifact.bytecode, `${name}.bytecode`);
      const args = typeof spec.args === "function" ? await spec.args({ deployments }) : spec.args ?? [];
      const account = ch.walletClient.account;
      if (!account) {
        throw new Error("withDeployments(...) requires a walletClient account.");
      }

      const hash = await ch.walletClient.deployContract({
        abi: spec.artifact.abi as never,
        bytecode,
        args: args as readonly unknown[],
        account,
      });

      const receipt = await ch.publicClient.waitForTransactionReceipt({ hash });
      const deployment: DeploymentRecord = {
        address: receipt.contractAddress!,
        receipt,
        contract: getContract({
          address: receipt.contractAddress!,
          abi: spec.artifact.abi as never,
          client: { public: ch.publicClient, wallet: ch.walletClient },
        }),
      };

      deployments[name] = deployment;

      if (spec.afterDeploy) {
        await spec.afterDeploy({
          chain: chainKey,
          name,
          deployment,
          deployments,
          wallet: ch.wallet,
        });
      }
    }

    await next({
      ...ctx,
      chains: {
        ...ctx.chains,
        [chainKey]: {
          ...ch,
          deployments,
        },
      },
    });
  };
}

import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import type { Address } from "viem";
import { requireRuntimeClients } from "../utils";
import type { BundlerClient } from "@st8craft/clients";
import { createBundlerClient } from "@st8craft/clients";
import type { ScenarioBundlerContext, ScenarioRuntimeClientsContext, ScenarioStep } from "../types";
import { startBundler } from "../internal/startBundler";

export type WithBundlerConfig = {
  /** ERC-4337 entry point address (typically EntryPoint v0.7 / v0.6). */
  entryPoint: Address;
  /** Bundler runtime mode. Currently only `alto` is supported. */
  mode?: "alto";
};

const DEFAULT_EXECUTOR_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

/**
 * Middleware: starts a local Alto bundler connected to the current Anvil runtime, then wires
 * a typed viem-compatible JSON-RPC client into scenario context.
 *
 * Requires `@pimlico/alto` to be installed in the host project (declared as a peer dependency).
 */
export function withBundler(config: WithBundlerConfig): ScenarioStep<ScenarioRuntimeClientsContext, ScenarioBundlerContext> {
  return async (ctx, next) => {
    requireRuntimeClients(ctx);

    if (!config?.entryPoint) {
      throw new Error("withBundler(...) requires `entryPoint`.");
    }

    if (config.mode && config.mode !== "alto") {
      throw new Error(`withBundler(...) only supports mode='alto'.`);
    }

    // Alto needs executor funds to submit bundle transactions; anvil dev keys are typically funded,
    // but we set balances explicitly to keep tests deterministic.
    const executorAccount: PrivateKeyAccount = privateKeyToAccount(DEFAULT_EXECUTOR_PRIVATE_KEY);
    const fundingBalance = 100n * 10n ** 18n;
    await ctx.testClient.setBalance({
      address: executorAccount.address,
      value: fundingBalance,
    });

    const bundler = await startBundler({
      rpcUrl: ctx.runtime.rpcUrl,
      entryPoint: config.entryPoint,
    });

    const bundlerClient: BundlerClient = createBundlerClient({
      bundlerUrl: bundler.bundlerUrl,
      chain: ctx.publicClient.chain,
      entryPoint: config.entryPoint,
    });

    try {
      await next({
        ...ctx,
        bundlerUrl: bundler.bundlerUrl,
        bundlerClient,
        entryPoint: config.entryPoint,
      });
    } finally {
      await bundler.stop();
    }
  };
}


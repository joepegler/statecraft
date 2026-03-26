import { createWalletClient, http, type Address } from "viem";
import type {
  ScenarioFundedWalletContext,
  ScenarioRuntimeClientsContext,
  ScenarioStep,
} from "../types.js";
import { requireRuntimeClients } from "../utils.js";

/** Options for impersonating an existing on-chain account via Anvil test client controls. */
export type withImpersonationConfig = {
  /** Address to impersonate for transaction signing in this scenario step. */
  address: Address;
  /** Optional ETH balance to set in wei before forwarding context. */
  balance?: bigint;
  /**
   * Whether to stop impersonating in `finally` after downstream steps finish.
   * Defaults to `true`.
   */
  stopOnExit?: boolean;
};

/**
 * Middleware: impersonates `config.address`, swaps in a wallet client for that account,
 * runs `next`, then stops impersonation by default.
 * Requires prior runtime fixtures (`withChain`, `withFork`, or `withExternalRuntime`).
 */
export function withImpersonation(
  config: withImpersonationConfig,
): ScenarioStep<ScenarioRuntimeClientsContext, ScenarioFundedWalletContext> {
  return async (ctx, next) => {
    requireRuntimeClients(ctx);

    await ctx.testClient.impersonateAccount({ address: config.address });

    if (config.balance !== undefined) {
      await ctx.testClient.setBalance({
        address: config.address,
        value: config.balance,
      });
    }

    const walletClient = createWalletClient({
      account: config.address,
      chain: ctx.publicClient.chain,
      transport: http(ctx.runtime.rpcUrl),
    });

    try {
      await next({
        ...ctx,
        wallet: config.address,
        walletClient,
      });
    } finally {
      if (config.stopOnExit !== false) {
        await ctx.testClient.stopImpersonatingAccount({
          address: config.address,
        });
      }
    }
  };
}

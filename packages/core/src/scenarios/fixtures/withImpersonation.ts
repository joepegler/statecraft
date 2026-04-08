import { createWalletClient, http, type Address } from "viem";
import type {
  ScenarioFundedWalletContext,
  ScenarioRuntimeClientsContext,
  ScenarioStep,
} from "../types.js";
import { requireChainScopedRuntimeClients } from "../utils.js";

/** Options for impersonating an existing on-chain account via Anvil test client controls. */
export type withImpersonationConfig = {
  /** Key on `ctx.chains` (default `default`). */
  chain?: string;
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
 * Middleware: impersonates `config.address` on `ctx.chains[chain]`, swaps in a wallet client for that account,
 * runs `next`, then stops impersonation by default.
 * Requires prior runtime fixtures for that chain (`withChain`, `withFork`, `withExternalRuntime`, or `withMultiChain`).
 */
export function withImpersonation(
  config: withImpersonationConfig & { chain?: undefined },
): ScenarioStep<ScenarioRuntimeClientsContext, ScenarioFundedWalletContext<"default">>;
export function withImpersonation<C extends string>(
  config: withImpersonationConfig & { chain: C },
): ScenarioStep<ScenarioRuntimeClientsContext, ScenarioFundedWalletContext<C>>;
export function withImpersonation(
  config: withImpersonationConfig,
): ScenarioStep<ScenarioRuntimeClientsContext, ScenarioRuntimeClientsContext> {
  const chainKey = config.chain ?? "default";
  return async (ctx, next) => {
    requireChainScopedRuntimeClients(ctx, chainKey);
    const ch = ctx.chains[chainKey]!;

    await ch.testClient.impersonateAccount({ address: config.address });

    if (config.balance !== undefined) {
      await ch.testClient.setBalance({
        address: config.address,
        value: config.balance,
      });
    }

    const walletClient = createWalletClient({
      account: config.address,
      chain: ch.publicClient.chain,
      transport: http(ch.runtime.rpcUrl),
    });

    const nextChains = {
      ...ctx.chains,
      [chainKey]: {
        ...ch,
        wallet: config.address,
        walletClient,
      },
    };

    try {
      await next({
        ...ctx,
        chains: nextChains,
      });
    } finally {
      if (config.stopOnExit !== false) {
        await ch.testClient.stopImpersonatingAccount({
          address: config.address,
        });
      }
    }
  };
}

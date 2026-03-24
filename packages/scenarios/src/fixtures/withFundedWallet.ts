import { createWalletClient, http, type Address, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { ScenarioFundedWalletContext, ScenarioRuntimeClientsContext, ScenarioStep } from "../types";
import { dealErc20Balance } from "../internal/dealErc20Balance";
import { requireRuntimeClients } from "../utils";

/** One ERC-20 balance to seed for the funded wallet (after ETH funding). */
export type WithFundedWalletErc20Balance = {
  /** ERC-20 token contract address. */
  token: Address;
  /** Balance in token raw units (e.g. from `parseUnits`). */
  amount: bigint;
};

/** Options for creating (or reusing) a test account and funding it on anvil. */
export type WithFundedWalletConfig = {
  /** Balance set via `testClient.setBalance` (wei). */
  balance: bigint;
  /** When set, uses this key; otherwise generates a new private key. */
  privateKey?: Hex;
  /**
   * Optional ERC-20 balances to seed for the funded address after it exists.
   * Same mechanics as {@link withErc20Balance} (test-only storage writes on Anvil-compatible nodes).
   */
  erc20?: readonly WithFundedWalletErc20Balance[];
};

/**
 * Middleware: ensures a funded account, sets `ctx.wallet`, and replaces `walletClient` with that account.
 * Requires a prior `withChain` / `withFork` so `testClient` and chain RPC are available.
 */
export function withFundedWallet(config: WithFundedWalletConfig): ScenarioStep<ScenarioRuntimeClientsContext, ScenarioFundedWalletContext> {
  return async (ctx, next) => {
    requireRuntimeClients(ctx);

    const privateKey = config.privateKey ?? generatePrivateKey();
    const account = privateKeyToAccount(privateKey);

    await ctx.testClient.setBalance({
      address: account.address,
      value: config.balance,
    });

    const walletClient = createWalletClient({
      account,
      chain: ctx.publicClient.chain,
      transport: http(ctx.runtime.rpcUrl),
    });

    const nextCtx: ScenarioFundedWalletContext = {
      ...ctx,
      wallet: account.address,
      walletClient,
    };

    if (config.erc20?.length) {
      for (const entry of config.erc20) {
        await dealErc20Balance({
          testClient: nextCtx.testClient,
          token: entry.token,
          recipient: account.address,
          amount: entry.amount,
        });
      }
    }

    await next(nextCtx);
  };
}

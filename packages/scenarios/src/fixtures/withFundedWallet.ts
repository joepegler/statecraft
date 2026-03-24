import { createWalletClient, http, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { ScenarioStep } from "../types";
import { requireRuntimeClients } from "../utils";

/** Options for creating (or reusing) a test account and funding it on anvil. */
export type WithFundedWalletConfig = {
  /** Balance set via `testClient.setBalance` (wei). */
  balance: bigint;
  /** When set, uses this key; otherwise generates a new private key. */
  privateKey?: Hex;
};

/**
 * Middleware: ensures a funded account, sets `ctx.wallet`, and replaces `walletClient` with that account.
 * Requires a prior `withChain` / `withFork` so `testClient` and chain RPC are available.
 */
export function withFundedWallet(config: WithFundedWalletConfig): ScenarioStep {
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

    await next({
      ...ctx,
      wallet: account.address,
      walletClient,
    });
  };
}

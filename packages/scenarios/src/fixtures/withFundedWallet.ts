import { createWalletClient, http, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { ScenarioStep } from "../types";
import { requireRuntimeClients } from "../utils";

export type WithFundedWalletConfig = {
  balance: bigint;
  privateKey?: Hex;
};

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

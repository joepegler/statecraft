import { createWalletClient, http, type Address, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type {
  ScenarioFundedWalletContext,
  ScenarioRuntimeClientsContext,
  ScenarioStep,
} from "../types.js";
import { dealErc20Balance } from "../internal/dealErc20Balance.js";
import { requireChainScopedRuntimeClients } from "../utils.js";

/** One ERC-20 balance to seed for the funded wallet (after ETH funding). */
export type WithFundedWalletErc20Balance = {
  /** ERC-20 token contract address. */
  token: Address;
  /** Balance in token raw units (e.g. from `parseUnits`). */
  amount: bigint;
};

/** Options for creating (or reusing) a test account and funding it on anvil. */
export type WithFundedWalletConfig = {
  /** Key on `ctx.chains` to fund (default `default`). */
  chain?: string;
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
 * Middleware: ensures a funded account on `ctx.chains[chain]`, sets `wallet` on that chain entry, and replaces `walletClient`.
 * Requires a prior runtime fixture for that chain.
 */
export function withFundedWallet(
  config: WithFundedWalletConfig,
): ScenarioStep<ScenarioRuntimeClientsContext, ScenarioFundedWalletContext> {
  const chainKey = config.chain ?? "default";
  return async (ctx, next) => {
    requireChainScopedRuntimeClients(ctx, chainKey);
    const ch = ctx.chains[chainKey]!;

    const privateKey = config.privateKey ?? generatePrivateKey();
    const account = privateKeyToAccount(privateKey);

    await ch.testClient.setBalance({
      address: account.address,
      value: config.balance,
    });

    const walletClient = createWalletClient({
      account,
      chain: ch.publicClient.chain,
      transport: http(ch.runtime.rpcUrl),
    });

    const updatedChain = {
      ...ch,
      wallet: account.address,
      walletClient,
    };

    const nextChains = {
      ...ctx.chains,
      [chainKey]: updatedChain,
    };

    if (config.erc20?.length) {
      for (const entry of config.erc20) {
        await dealErc20Balance({
          testClient: updatedChain.testClient,
          token: entry.token,
          recipient: account.address,
          amount: entry.amount,
        });
      }
    }

    await next({
      ...ctx,
      chains: nextChains,
    });
  };
}

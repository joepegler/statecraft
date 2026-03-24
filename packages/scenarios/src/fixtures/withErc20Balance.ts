import type { Address } from "viem";
import type { ScenarioContext, ScenarioFundedWalletContext, ScenarioRuntimeClientsContext, ScenarioStep } from "../types";
import { dealErc20Balance } from "../internal/dealErc20Balance";
import { requireRuntimeClients } from "../utils";

/**
 * Options for {@link withErc20Balance}: seeds an ERC-20 balance in local/forked test state.
 *
 * This is a **test-only** fixture: it rewrites storage (or equivalent) on the node—it does not mint
 * tokens on-chain in production and must not be used outside compatible local test runtimes.
 */
export type WithErc20BalanceConfig = {
  /** ERC-20 token contract address. */
  token: Address;
  /** Balance to set (token raw units, e.g. from `parseUnits`). */
  amount: bigint;
  /**
   * Recipient address. When omitted, uses `ctx.wallet` from {@link withFundedWallet} (or any step that sets it).
   */
  to?: Address;
};

export type WithErc20Balance = {
  (config: WithErc20BalanceConfig & { to: Address }): ScenarioStep<ScenarioRuntimeClientsContext, ScenarioRuntimeClientsContext>;
  (config: Omit<WithErc20BalanceConfig, "to">): ScenarioStep<ScenarioFundedWalletContext, ScenarioFundedWalletContext>;
};

/**
 * Middleware: sets an ERC-20 balance for a recipient on Anvil-compatible runtimes.
 *
 * Requires a prior {@link withChain} or {@link withFork} (for `testClient`). If `to` is omitted,
 * requires {@link withFundedWallet} or another step that sets `ctx.wallet`.
 *
 * May fail for non-standard tokens (e.g. rebasing or unusual storage layouts); it is not a generic mint path.
 */
export const withErc20Balance: WithErc20Balance = ((config: WithErc20BalanceConfig) => {
  return async (ctx, next) => {
    requireRuntimeClients(ctx);

    const recipient = config.to ?? ctx.wallet;
    if (!recipient) {
      throw new Error(
        "withErc20Balance(...) requires a recipient: pass `to`, or compose withFundedWallet(...) so ctx.wallet is set.",
      );
    }

    await dealErc20Balance({
      testClient: ctx.testClient,
      token: config.token,
      recipient,
      amount: config.amount,
    });

    const forward = next as (out: ScenarioContext) => Promise<void>;
    if (config.to !== undefined) {
      await forward({ ...ctx });
    } else {
      await forward({ ...ctx, wallet: recipient });
    }
  };
}) as WithErc20Balance;

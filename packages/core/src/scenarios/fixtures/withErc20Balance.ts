import type { Address } from "viem";
import type {
  ScenarioContext,
  ScenarioRuntimeClientsContext,
  ScenarioStep,
  ScenarioWalletOnChainContext,
} from "../types.js";
import { dealErc20Balance } from "../internal/dealErc20Balance.js";
import { requireChainScopedRuntimeClients } from "../utils.js";

/**
 * Options for {@link withErc20Balance}: seeds an ERC-20 balance in local/forked test state.
 *
 * This is a **test-only** fixture: it rewrites storage (or equivalent) on the node—it does not mint
 * tokens on-chain in production and must not be used outside compatible local test runtimes.
 */
export type WithErc20BalanceConfig = {
  /** Key on `ctx.chains` (default `default`). */
  chain?: string;
  /** ERC-20 token contract address. */
  token: Address;
  /** Balance to set (token raw units, e.g. from `parseUnits`). */
  amount: bigint;
  /**
   * Recipient address. When omitted, uses `ctx.chains[chain].wallet` from {@link withFundedWallet} (or any step that sets it).
   */
  to?: Address;
};

export type WithErc20Balance = {
  <Ctx extends ScenarioRuntimeClientsContext>(config: WithErc20BalanceConfig & { to: Address }): ScenarioStep<Ctx, Ctx>;
  <Ctx extends ScenarioRuntimeClientsContext>(config: Omit<WithErc20BalanceConfig, "to"> & { chain?: undefined }): ScenarioStep<
    ScenarioWalletOnChainContext<Ctx, "default">,
    ScenarioWalletOnChainContext<Ctx, "default">
  >;
  <Ctx extends ScenarioRuntimeClientsContext, C extends string>(config: Omit<WithErc20BalanceConfig, "to"> & { chain: C }): ScenarioStep<
    ScenarioWalletOnChainContext<Ctx, C>,
    ScenarioWalletOnChainContext<Ctx, C>
  >;
};

/**
 * Middleware: sets an ERC-20 balance for a recipient on Anvil-compatible runtimes.
 *
 * Requires a prior runtime fixture for `chain`. If `to` is omitted,
 * requires {@link withFundedWallet} or another step that sets `ctx.chains[chain].wallet`.
 *
 * May fail for non-standard tokens (e.g. rebasing or unusual storage layouts); it is not a generic mint path.
 */
export const withErc20Balance: WithErc20Balance = ((config: WithErc20BalanceConfig) => {
  const chainKey = config.chain ?? "default";
  return async (ctx: ScenarioContext, next: (ctx: ScenarioContext) => Promise<void>) => {
    requireChainScopedRuntimeClients(ctx, chainKey);
    const ch = ctx.chains[chainKey]!;

    const recipient = config.to ?? ch.wallet;
    if (!recipient) {
      throw new Error(
        `withErc20Balance(...) requires a recipient: pass \`to\`, or compose withFundedWallet(...) so ctx.chains["${chainKey}"].wallet is set.`,
      );
    }

    await dealErc20Balance({
      testClient: ch.testClient,
      token: config.token,
      recipient,
      amount: config.amount,
    });

    const forward = next as (out: ScenarioContext) => Promise<void>;
    if (config.to !== undefined) {
      await forward({ ...ctx });
    } else {
      await forward({
        ...ctx,
        chains: {
          ...ctx.chains,
          [chainKey]: {
            ...ch,
            wallet: recipient,
          },
        },
      });
    }
  };
}) as WithErc20Balance;

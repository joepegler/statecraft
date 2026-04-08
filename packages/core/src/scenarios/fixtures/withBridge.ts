import { erc20Abi, isAddressEqual, type Address } from "viem";
import { dealErc20Balance } from "../internal/dealErc20Balance.js";
import {
  NATIVE_TOKEN_ADDRESS,
  type BridgeExecuteArgs,
  type BridgeExecution,
  type ScenarioBridge,
  type ScenarioBridgeContext,
  type ScenarioRuntimeClientsContext,
  type ScenarioStep,
  type WithBridgeConfig,
} from "../types.js";
import { requireChainScopedRuntimeClients } from "../utils.js";

const NATIVE_TOKEN = NATIVE_TOKEN_ADDRESS as Address;

function isNativeToken(token: Address): boolean {
  return isAddressEqual(token, NATIVE_TOKEN);
}

/**
 * Middleware: exposes `ctx.bridge.execute(...)` so tests can simulate a deterministic bridge transfer
 * at a chosen moment.
 */
export function withBridge<C extends ScenarioRuntimeClientsContext>(
  config: WithBridgeConfig,
): ScenarioStep<
  C & { chains: C["chains"] },
  C & { chains: C["chains"]; bridge: ScenarioBridgeContext["bridge"] }
> {
  const priceScale = config.priceScale ?? 1n;
  if (priceScale <= 0n) {
    throw new Error("withBridge(...) requires priceScale to be greater than zero.");
  }

  return async (ctx, next) => {
    requireChainScopedRuntimeClients(ctx, config.srcChain);
    requireChainScopedRuntimeClients(ctx, config.destChain);

    const src = ctx.chains[config.srcChain]!;
    const dest = ctx.chains[config.destChain]!;

    if (ctx.bridge) {
      throw new Error("withBridge(...) ctx.bridge is already defined. Compose at most one withBridge(...) per scenario.");
    }

    const bridge: ScenarioBridge = {
      execute: async ({ amountIn, price, from, to }: BridgeExecuteArgs): Promise<BridgeExecution> => {
        if (amountIn < 0n) {
          throw new Error("withBridge(...).execute(...) requires amountIn to be non-negative.");
        }
        if (price < 0n) {
          throw new Error("withBridge(...).execute(...) requires price to be non-negative.");
        }

        const fromAddress = from ?? config.from ?? src.wallet;
        if (!fromAddress) {
          throw new Error(
            `withBridge(...).execute(...) requires a source recipient: pass \`from\`, configure \`config.from\`, or compose withFundedWallet(...) on source chain "${config.srcChain}".`,
          );
        }

        const toAddress = to ?? config.to ?? dest.wallet;
        if (!toAddress) {
          throw new Error(
            `withBridge(...).execute(...) requires a destination recipient: pass \`to\`, configure \`config.to\`, or compose withFundedWallet(...) on destination chain "${config.destChain}".`,
          );
        }

        const amountOut = (amountIn * price) / priceScale;

        await debitAsset({
          chain: src,
          token: config.fromToken,
          owner: fromAddress,
          amount: amountIn,
          label: "source",
        });

        await creditAsset({
          chain: dest,
          token: config.toToken,
          owner: toAddress,
          amount: amountOut,
        });

        return {
          srcChain: config.srcChain,
          destChain: config.destChain,
          fromToken: config.fromToken,
          toToken: config.toToken,
          from: fromAddress,
          to: toAddress,
          amountIn,
          amountOut,
          price,
        };
      },
    };

    await next({
      ...ctx,
      bridge,
    });
  };
}

async function debitAsset({
  chain,
  token,
  owner,
  amount,
  label,
}: {
  chain: ScenarioRuntimeClientsContext["chains"][string];
  token: Address;
  owner: Address;
  amount: bigint;
  label: "source" | "destination";
}): Promise<void> {
  if (isNativeToken(token)) {
    const current = await chain.publicClient.getBalance({ address: owner });
    if (current < amount) {
      throw new Error(`withBridge(...).execute(...) insufficient native ${label} balance: wanted ${amount}, got ${current}.`);
    }
    await chain.testClient.setBalance({ address: owner, value: current - amount });
    return;
  }

  const current = await chain.publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [owner],
  });

  if (current < amount) {
    throw new Error(`withBridge(...).execute(...) insufficient ERC-20 ${label} balance: wanted ${amount}, got ${current}.`);
  }

  await dealErc20Balance({
    testClient: chain.testClient,
    token,
    recipient: owner,
    amount: current - amount,
  });
}

async function creditAsset({
  chain,
  token,
  owner,
  amount,
}: {
  chain: ScenarioRuntimeClientsContext["chains"][string];
  token: Address;
  owner: Address;
  amount: bigint;
}): Promise<void> {
  if (isNativeToken(token)) {
    const current = await chain.publicClient.getBalance({ address: owner });
    await chain.testClient.setBalance({ address: owner, value: current + amount });
    return;
  }

  const current = await chain.publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [owner],
  });

  await dealErc20Balance({
    testClient: chain.testClient,
    token,
    recipient: owner,
    amount: current + amount,
  });
}

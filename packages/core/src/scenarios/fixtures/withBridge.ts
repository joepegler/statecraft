import { erc20Abi, isAddressEqual, type Address } from "viem";
import { dealErc20Balance } from "../internal/dealErc20Balance.js";
import {
  NATIVE_TOKEN_ADDRESS,
  type BridgeExecuteArgs,
  type BridgeExecution,
  type ScenarioChainContext,
  type ScenarioBridge,
  type ScenarioBridgeContext,
  type ScenarioRuntimeClientsContext,
  type ScenarioStep,
  type WithBridgeConfig,
} from "../types.js";
import { requireChainScopedRuntimeClients } from "../utils.js";
import { StatecraftError } from "../errors.js";
import type { ActionPreflight, PreflightIssue } from "../actions.js";
import { labelScenarioStep } from "../stepMeta.js";

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
    throw new StatecraftError({
      code: "SC_PRECONDITION_FAILED",
      reason: "withBridge(...) requires priceScale to be greater than zero.",
      context: { priceScale: String(priceScale) },
      suggestedAction: "Provide a positive bigint priceScale.",
    });
  }

  return labelScenarioStep(async (ctx, next) => {
    requireChainScopedRuntimeClients(ctx, config.srcChain);
    requireChainScopedRuntimeClients(ctx, config.destChain);

    const src = ctx.chains[config.srcChain]!;
    const dest = ctx.chains[config.destChain]!;

    if (ctx.bridge) {
      throw new StatecraftError({
        code: "SC_CONSTRAINT_VIOLATION",
        reason: "withBridge(...) ctx.bridge is already defined. Compose at most one withBridge(...) per scenario.",
        suggestedAction: "Use a single withBridge(...) step and invoke bridge.execute(...) multiple times as needed.",
      });
    }

    const executionLedger = new Map<string, { fingerprint: string; result: BridgeExecution }>();
    const bridge: ScenarioBridge = {
      preflight: async ({ amountIn, price, from, to }: BridgeExecuteArgs): Promise<ActionPreflight> => {
        return preflightBridgeExecution({
          src,
          dest,
          config,
          amountIn,
          price,
          from,
          to,
          priceScale,
        });
      },
      execute: async ({ amountIn, price, from, to, idempotencyKey }: BridgeExecuteArgs): Promise<BridgeExecution> => {
        if (idempotencyKey) {
          const fingerprint = buildExecutionFingerprint({
            amountIn,
            price,
            from,
            to,
            srcChain: config.srcChain,
            destChain: config.destChain,
            fromToken: config.fromToken,
            toToken: config.toToken,
          });
          const seen = executionLedger.get(idempotencyKey);
          if (seen) {
            if (seen.fingerprint !== fingerprint) {
              throw new StatecraftError({
                code: "SC_CONSTRAINT_VIOLATION",
                reason: "Bridge idempotency key reused with a different payload.",
                context: {
                  idempotencyKey,
                },
                suggestedAction: "Use a unique idempotency key per distinct bridge payload.",
              });
            }
            return seen.result;
          }
        }

        const preflight = await preflightBridgeExecution({
          src,
          dest,
          config,
          amountIn,
          price,
          from,
          to,
          priceScale,
        });
        if (!preflight.canExecute) {
          throw new StatecraftError({
            code: "SC_PRECONDITION_FAILED",
            reason: "withBridge(...).execute(...) preflight failed.",
            context: preflight,
            suggestedAction: "Inspect preflight reasons and satisfy requirements before bridge.execute(...).",
          });
        }

        const fromAddress = from ?? config.from ?? src.wallet;
        const toAddress = to ?? config.to ?? dest.wallet;

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

        const result = {
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
        if (idempotencyKey) {
          executionLedger.set(idempotencyKey, {
            fingerprint: buildExecutionFingerprint({
              amountIn,
              price,
              from,
              to,
              srcChain: config.srcChain,
              destChain: config.destChain,
              fromToken: config.fromToken,
              toToken: config.toToken,
            }),
            result,
          });
        }
        return result;
      },
    };

    await next({
      ...ctx,
      bridge,
    });
  }, "withBridge");
}

function buildExecutionFingerprint(args: {
  amountIn: bigint;
  price: bigint;
  from?: Address;
  to?: Address;
  srcChain: string;
  destChain: string;
  fromToken: Address;
  toToken: Address;
}): string {
  return [
    args.srcChain,
    args.destChain,
    args.fromToken.toLowerCase(),
    args.toToken.toLowerCase(),
    args.from?.toLowerCase() ?? "",
    args.to?.toLowerCase() ?? "",
    args.amountIn.toString(),
    args.price.toString(),
  ].join("|");
}

async function preflightBridgeExecution(args: {
  src: ScenarioChainContext;
  dest: ScenarioChainContext;
  config: WithBridgeConfig;
  amountIn: bigint;
  price: bigint;
  from?: Address;
  to?: Address;
  priceScale: bigint;
}): Promise<ActionPreflight> {
  const reasons: PreflightIssue[] = [];
  if (args.amountIn < 0n) {
    reasons.push({
      code: "BRIDGE_AMOUNT_INVALID",
      reason: "Bridge amountIn must be non-negative.",
      context: { amountIn: String(args.amountIn) },
    });
  }
  if (args.price < 0n) {
    reasons.push({
      code: "BRIDGE_PRICE_INVALID",
      reason: "Bridge price must be non-negative.",
      context: { price: String(args.price) },
    });
  }

  const fromAddress = args.from ?? args.config.from ?? args.src.wallet;
  if (!fromAddress) {
    reasons.push({
      code: "BRIDGE_FROM_MISSING",
      reason: `Missing source recipient for chain "${args.config.srcChain}".`,
      context: { chain: args.config.srcChain },
    });
  }

  const toAddress = args.to ?? args.config.to ?? args.dest.wallet;
  if (!toAddress) {
    reasons.push({
      code: "BRIDGE_TO_MISSING",
      reason: `Missing destination recipient for chain "${args.config.destChain}".`,
      context: { chain: args.config.destChain },
    });
  }

  return {
    canExecute: reasons.length === 0,
    reasons,
    assumptions: [
      "Bridge transfer assumes source/destination chain state remains unchanged between preflight and execute.",
      "Bridge pricing uses integer math amountOut = amountIn * price / priceScale.",
    ],
    estimatedEffects: {
      amountIn: String(args.amountIn),
      amountOut: String((args.amountIn * args.price) / args.priceScale),
      srcChain: args.config.srcChain,
      destChain: args.config.destChain,
      fromToken: args.config.fromToken,
      toToken: args.config.toToken,
    },
  };
}

async function debitAsset({
  chain,
  token,
  owner,
  amount,
  label,
}: {
  chain: ScenarioChainContext;
  token: Address;
  owner: Address;
  amount: bigint;
  label: "source" | "destination";
}): Promise<void> {
  if (isNativeToken(token)) {
    const current = await chain.publicClient.getBalance({ address: owner });
    if (current < amount) {
      throw new StatecraftError({
        code: "SC_PRECONDITION_FAILED",
        reason: `withBridge(...).execute(...) insufficient native ${label} balance.`,
        context: { wanted: String(amount), got: String(current), label },
        suggestedAction: "Fund the source account or reduce amountIn.",
      });
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
    throw new StatecraftError({
      code: "SC_PRECONDITION_FAILED",
      reason: `withBridge(...).execute(...) insufficient ERC-20 ${label} balance.`,
      context: { wanted: String(amount), got: String(current), label, token },
      suggestedAction: "Seed token balance before execute(...) or reduce amountIn.",
    });
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
  chain: ScenarioChainContext;
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

import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import type { Address } from "viem";
import { requireChainScopedRuntimeClients } from "../utils.js";
import type { BundlerClient } from "../../clients/index.js";
import { createBundlerClient } from "../../clients/index.js";
import type { ScenarioBundlerOnChainContext, ScenarioRuntimeClientsContext, ScenarioStep } from "../types.js";
import { startBundler } from "../internal/startBundler.js";
import { StatecraftError } from "../errors.js";
import { labelScenarioStep } from "../stepMeta.js";

export type WithBundlerConfig = {
  /** Key on `ctx.chains` (default `default`). */
  chain?: string;
  /** ERC-4337 entry point address (typically EntryPoint v0.7 / v0.6). */
  entryPoint: Address;
  /** Bundler runtime mode. Currently only `alto` is supported. */
  mode?: "alto";
};

const DEFAULT_EXECUTOR_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

/**
 * Middleware: starts a local Alto bundler connected to the Anvil runtime for `ctx.chains[chain]`, then wires
 * a typed viem-compatible JSON-RPC client into that chain entry.
 *
 * Requires `@pimlico/alto` to be installed in the host project (declared as a peer dependency).
 */
export function withBundler<Ctx extends ScenarioRuntimeClientsContext>(
  config: WithBundlerConfig & { chain?: undefined },
): ScenarioStep<Ctx, ScenarioBundlerOnChainContext<Ctx, "default">>;
export function withBundler<Ctx extends ScenarioRuntimeClientsContext, C extends string>(
  config: WithBundlerConfig & { chain: C },
): ScenarioStep<Ctx, ScenarioBundlerOnChainContext<Ctx, C>>;
export function withBundler(
  config: WithBundlerConfig,
): ScenarioStep<any, any> {
  const chainKey = config.chain ?? "default";
  return labelScenarioStep(async (
    ctx: ScenarioRuntimeClientsContext,
    next: (ctx: ScenarioRuntimeClientsContext) => Promise<void>,
  ) => {
    requireChainScopedRuntimeClients(ctx, chainKey);
    const ch = ctx.chains[chainKey]!;

    if (ch.runtimeMode !== "fork") {
      throw new StatecraftError({
        code: "SC_PRECONDITION_FAILED",
        reason: "withBundler(...) requires withFork(...) (or a fork entry in withMultiChain) for that chain first.",
        context: { chain: chainKey, runtimeMode: ch.runtimeMode },
        suggestedAction: "Compose withFork(...) before withBundler(...) for this chain.",
      });
    }

    if (!config?.entryPoint) {
      throw new StatecraftError({
        code: "SC_PRECONDITION_FAILED",
        reason: "withBundler(...) requires `entryPoint`.",
        context: { chain: chainKey },
        suggestedAction: "Pass an ERC-4337 entryPoint address to withBundler(...).",
      });
    }

    if (config.mode && config.mode !== "alto") {
      throw new StatecraftError({
        code: "SC_BUNDLER_UNSUPPORTED_MODE",
        reason: "withBundler(...) only supports mode='alto'.",
        context: { requestedMode: config.mode },
        suggestedAction: "Set mode to 'alto' or omit mode.",
      });
    }

    const executorAccount: PrivateKeyAccount = privateKeyToAccount(DEFAULT_EXECUTOR_PRIVATE_KEY);
    const fundingBalance = 100n * 10n ** 18n;
    await ch.testClient.setBalance({
      address: executorAccount.address,
      value: fundingBalance,
    });

    const bundler = await startBundler({
      rpcUrl: ch.runtime.rpcUrl,
      entryPoint: config.entryPoint,
    });

    const bundlerClient: BundlerClient = createBundlerClient({
      bundlerUrl: bundler.bundlerUrl,
      chain: ch.chain,
      entryPoint: config.entryPoint,
    });

    try {
      await next({
        ...ctx,
        chains: {
          ...ctx.chains,
          [chainKey]: {
            ...ch,
            bundlerUrl: bundler.bundlerUrl,
            bundlerClient,
            entryPoint: config.entryPoint,
          },
        },
      });
    } finally {
      await bundler.stop();
    }
  }, "withBundler");
}

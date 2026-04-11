import type { ContractArtifact, ScenarioChainContext, ScenarioContext } from "./types.js";
import type { Hex } from "viem";
import { StatecraftError } from "./errors.js";

export const SCENARIO_MAX_CHAINS = 2;
export const BUNDLER_SUPPORTED_MODES = ["alto"] as const;
export const PUBLIC_CLIENT_ALIAS_POLICIES = ["prefer-default-then-lexical", "lexical"] as const;
export type PublicClientAliasPolicy = (typeof PUBLIC_CLIENT_ALIAS_POLICIES)[number];

/**
 * Context with the listed keys required (non-undefined).
 *
 * @typeParam Ctx - Scenario context shape before narrowing.
 * @typeParam K - Keys that must be present after {@link requireContext} succeeds.
 */
export type RequireScenarioKeys<
  Ctx extends ScenarioContext,
  K extends readonly (keyof ScenarioContext)[],
> = Ctx & Required<Pick<ScenarioContext, K[number]>>;

/**
 * Narrows `ctx` by asserting the given keys are defined. Throws with an actionable message if any are missing.
 *
 * Use when a test or custom step needs a subset of fields without non-null assertions, or when the typed
 * pipeline still leaves some keys optional.
 */
export function requireContext<
  Ctx extends ScenarioContext,
  const K extends readonly (keyof ScenarioContext)[],
>(ctx: Ctx, ...keys: K): RequireScenarioKeys<Ctx, K> {
  for (const key of keys) {
    if (ctx[key as keyof ScenarioContext] === undefined) {
      throw new StatecraftError({
        code: "SC_CONTEXT_MISSING",
        reason: `Scenario context is missing required key: ${String(key)}`,
        context: { key: String(key) },
        suggestedAction: "Compose a fixture that populates this key before reading it.",
      });
    }
  }
  return ctx as RequireScenarioKeys<Ctx, K>;
}

/**
 * Asserts `ctx.chains[chainKey]` exists and has runtime + viem clients.
 */
export function requireChainScopedRuntimeClients<K extends string>(
  ctx: ScenarioContext,
  chainKey: K,
): asserts ctx is ScenarioContext & {
  chains: Record<string, ScenarioChainContext> & Record<K, ScenarioChainContext>;
} {
  const ch = ctx.chains?.[chainKey];
  if (!ch?.runtime || !ch.publicClient || !ch.walletClient || !ch.testClient) {
    throw new StatecraftError({
      code: "SC_CONTEXT_MISSING",
      reason: `Scenario context is missing runtime clients for chain "${chainKey}".`,
      context: { chainKey },
      suggestedAction:
        "Compose withChain(...), withFork(...), withExternalRuntime(...), or withMultiChain(...) before this step.",
    });
  }
}

/**
 * Derives deterministic top-level public client aliases from a chains map.
 * Prefers `default` as primary when present; otherwise uses lexical key order.
 */
export function resolvePublicClientAliases(chains: Record<string, ScenarioChainContext>): {
  publicClient: ScenarioChainContext["publicClient"];
  altPublicClient: ScenarioChainContext["publicClient"] | undefined;
}
export function resolvePublicClientAliases(
  chains: Record<string, ScenarioChainContext>,
  policy: PublicClientAliasPolicy,
): {
  publicClient: ScenarioChainContext["publicClient"];
  altPublicClient: ScenarioChainContext["publicClient"] | undefined;
}
export function resolvePublicClientAliases(
  chains: Record<string, ScenarioChainContext>,
  policy: PublicClientAliasPolicy = "prefer-default-then-lexical",
): {
  publicClient: ScenarioChainContext["publicClient"];
  altPublicClient: ScenarioChainContext["publicClient"] | undefined;
} {
  const keys = Object.keys(chains);
  if (keys.length > SCENARIO_MAX_CHAINS) {
    throw new StatecraftError({
      code: "SC_CONSTRAINT_VIOLATION",
      reason: "Scenario context supports at most two chains.",
      context: { chainCount: keys.length, maxChains: SCENARIO_MAX_CHAINS },
      suggestedAction: "Split this test into multiple scenarios or choose no more than two chains.",
    });
  }

  const sortedKeys = keys.sort();
  const primaryKey =
    policy === "prefer-default-then-lexical"
      ? sortedKeys.includes("default")
        ? "default"
        : sortedKeys[0]
      : sortedKeys[0];
  if (!primaryKey) {
    throw new StatecraftError({
      code: "SC_CONTEXT_MISSING",
      reason: "Scenario context is missing runtime clients.",
      suggestedAction:
        "Compose withChain(...), withFork(...), withExternalRuntime(...), or withMultiChain(...) first.",
    });
  }

  const altKey = sortedKeys.find((key) => key !== primaryKey);
  return {
    publicClient: chains[primaryKey]!.publicClient,
    altPublicClient: altKey ? chains[altKey]!.publicClient : undefined,
  };
}

/**
 * Enforces the scenario two-chain cap.
 */
export function assertTwoChainLimit(chains: Record<string, ScenarioChainContext>): void {
  if (Object.keys(chains).length > SCENARIO_MAX_CHAINS) {
    throw new StatecraftError({
      code: "SC_CONSTRAINT_VIOLATION",
      reason: "Scenario context supports at most two chains.",
      context: { chainCount: Object.keys(chains).length, maxChains: SCENARIO_MAX_CHAINS },
      suggestedAction: "Split this test into multiple scenarios or choose no more than two chains.",
    });
  }
}

export function describeScenarioConstraints() {
  return {
    maxChains: SCENARIO_MAX_CHAINS,
    publicClientAliasPolicies: [...PUBLIC_CLIENT_ALIAS_POLICIES],
    defaultAliasPolicy: "prefer-default-then-lexical" as const,
    supportedBundlerModes: [...BUNDLER_SUPPORTED_MODES],
  };
}

export function extractBytecode(value: ContractArtifact["bytecode"] | ContractArtifact["deployedBytecode"], label: string): Hex {
  if (typeof value === "string" && value.startsWith("0x")) {
    return value;
  }

  if (value && typeof value === "object" && typeof value.object === "string" && value.object.startsWith("0x")) {
    return value.object;
  }

  throw new StatecraftError({
    code: "SC_PRECONDITION_FAILED",
    reason: `${label} is missing usable bytecode (expected a 0x-prefixed hex string).`,
    context: { label },
    suggestedAction: "Provide bytecode as a 0x-prefixed hex string or artifact.object field.",
  });
}

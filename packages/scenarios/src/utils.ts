import type { ContractArtifact, ScenarioContext } from "./types";
import type { Hex } from "viem";

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
      throw new Error(`Scenario context is missing required key: ${String(key)}`);
    }
  }
  return ctx as RequireScenarioKeys<Ctx, K>;
}

export function requireRuntimeClients(ctx: ScenarioContext): asserts ctx is ScenarioContext & {
  runtime: NonNullable<ScenarioContext["runtime"]>;
  publicClient: NonNullable<ScenarioContext["publicClient"]>;
  walletClient: NonNullable<ScenarioContext["walletClient"]>;
  testClient: NonNullable<ScenarioContext["testClient"]>;
} {
  if (!ctx.runtime || !ctx.publicClient || !ctx.walletClient || !ctx.testClient) {
    throw new Error("Scenario context is missing runtime clients. Compose with withChain(...) or withFork(...) first.");
  }
}

export function extractBytecode(value: ContractArtifact["bytecode"] | ContractArtifact["deployedBytecode"], label: string): Hex {
  if (typeof value === "string" && value.startsWith("0x")) {
    return value;
  }

  if (value && typeof value === "object" && typeof value.object === "string" && value.object.startsWith("0x")) {
    return value.object;
  }

  throw new Error(`${label} is missing usable bytecode (expected a 0x-prefixed hex string).`);
}

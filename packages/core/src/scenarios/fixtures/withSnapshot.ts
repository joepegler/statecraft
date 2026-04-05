import type { ScenarioRuntimeClientsContext, ScenarioStep } from "../types.js";
import { requireChainScopedRuntimeClients } from "../utils.js";

/** Options for {@link withSnapshot}. */
export type WithSnapshotConfig = {
  /** Key on `ctx.chains` to snapshot (default `default`). */
  chain?: string;
};

/**
 * Middleware: takes an anvil snapshot on `ctx.chains[chain]` before `next`, then reverts to it in `finally`
 * (isolates side effects of inner steps). Requires a prior runtime fixture for that chain.
 */
export function withSnapshot(config: WithSnapshotConfig = {}): ScenarioStep<ScenarioRuntimeClientsContext, ScenarioRuntimeClientsContext> {
  const chainKey = config.chain ?? "default";
  return async (ctx, next) => {
    requireChainScopedRuntimeClients(ctx, chainKey);
    const ch = ctx.chains[chainKey]!;

    const snapshotId = await ch.testClient.snapshot();
    try {
      await next(ctx);
    } finally {
      await ch.testClient.revert({ id: snapshotId });
    }
  };
}

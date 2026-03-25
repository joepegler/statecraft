import type { ScenarioRuntimeClientsContext, ScenarioStep } from "../types.js";
import { requireRuntimeClients } from "../utils.js";

/**
 * Middleware: takes an anvil snapshot before `next`, then reverts to it in `finally`
 * (isolates side effects of inner steps). Requires `withChain` / `withFork`.
 */
export function withSnapshot(): ScenarioStep<ScenarioRuntimeClientsContext, ScenarioRuntimeClientsContext> {
  return async (ctx, next) => {
    requireRuntimeClients(ctx);

    const snapshotId = await ctx.testClient.snapshot();
    try {
      await next(ctx);
    } finally {
      await ctx.testClient.revert({ id: snapshotId });
    }
  };
}

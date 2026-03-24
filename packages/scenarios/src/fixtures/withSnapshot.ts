import type { ScenarioStep } from "../types";
import { requireRuntimeClients } from "../utils";

export function withSnapshot(): ScenarioStep {
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

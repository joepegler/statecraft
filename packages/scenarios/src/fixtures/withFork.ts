import { startRuntime, stopRuntime } from "@statecraft/runtime";
import { createClients } from "@statecraft/clients";
import type { ScenarioStep } from "../types";

export type WithForkConfig = {
  rpcUrl: string;
  blockNumber: bigint;
  chainId?: number;
  key?: string;
};

export function withFork(config: WithForkConfig): ScenarioStep {
  return async (ctx, next) => {
    if (!config.rpcUrl) {
      throw new Error("withFork(...) requires rpcUrl.");
    }

    if (config.blockNumber === undefined) {
      throw new Error("withFork(...) requires a pinned blockNumber in v1.");
    }

    const runtime = await startRuntime({
      mode: "fork",
      rpcUrl: config.rpcUrl,
      blockNumber: config.blockNumber,
      ...(config.chainId !== undefined ? { chainId: config.chainId } : {}),
      ...(config.key !== undefined ? { key: config.key } : {}),
    });
    const clients = createClients(runtime, config.chainId !== undefined ? { chainId: config.chainId } : {});

    try {
      await next({
        ...ctx,
        runtime,
        publicClient: clients.publicClient,
        walletClient: clients.walletClient,
        testClient: clients.testClient,
      });
    } finally {
      await stopRuntime(runtime);
    }
  };
}

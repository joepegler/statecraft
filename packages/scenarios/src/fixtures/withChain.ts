import { startRuntime, stopRuntime } from "@statecraft/runtime";
import { createClients } from "@statecraft/clients";
import type { ScenarioStep } from "../types";

export type WithChainConfig = {
  chainId?: number;
  key?: string;
};

export function withChain(config: WithChainConfig = {}): ScenarioStep {
  return async (ctx, next) => {
    const runtime = await startRuntime({
      mode: "chain",
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

import { createClients, type CreateClientsOptions } from "../../clients/index.js";
import type { RuntimeHandle, RuntimeMode } from "../../runtime/index.js";
import type { EmptyScenarioContext, ScenarioRuntimeClientsContext, ScenarioStep } from "../types.js";

/**
 * Options for attaching an existing runtime handle to scenario context.
 * Lifecycle is external: this fixture never starts or stops anvil.
 */
export type WithExternalRuntimeConfig = {
  /** Live runtime handle created by `startRuntime(...)`. */
  runtime: RuntimeHandle;
  /**
   * Runtime mode for this external handle.
   * Defaults to `chain` when omitted.
   */
  runtimeMode?: RuntimeMode;
  /** Optional client wiring overrides (chain identity and signer key). */
  clients?: CreateClientsOptions;
};

/**
 * Middleware: attaches a caller-owned runtime and viem clients, then runs `next`.
 *
 * Use this when test hooks own lifecycle (`beforeAll`/`afterAll`) and scenarios should
 * reuse a suite-scoped anvil process.
 */
export function withExternalRuntime(config: WithExternalRuntimeConfig): ScenarioStep<EmptyScenarioContext, ScenarioRuntimeClientsContext> {
  return async (ctx, next) => {
    const clients = createClients(config.runtime, config.clients);

    await next({
      ...ctx,
      runtime: config.runtime,
      runtimeMode: config.runtimeMode ?? "chain",
      chain: clients.publicClient.chain,
      publicClient: clients.publicClient,
      walletClient: clients.walletClient,
      testClient: clients.testClient,
    });
  };
}

import { createClients, type CreateClientsOptions } from "@statecraft/clients";
import type { RuntimeHandle } from "@statecraft/runtime";
import type { EmptyScenarioContext, ScenarioRuntimeClientsContext, ScenarioStep } from "../types";

/**
 * Options for attaching an existing runtime handle to scenario context.
 * Lifecycle is external: this fixture never starts or stops anvil.
 */
export type WithExternalRuntimeConfig = {
  /** Live runtime handle created by `startRuntime(...)`. */
  runtime: RuntimeHandle;
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
      publicClient: clients.publicClient,
      walletClient: clients.walletClient,
      testClient: clients.testClient,
    });
  };
}

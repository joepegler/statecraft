import { expectTypeOf, test } from "vitest";
import { parseEther } from "viem";
import { scenario } from "../src/scenario";
import { withChain } from "../src/fixtures/withChain";
import { withFork } from "../src/fixtures/withFork";
import { withExternalRuntime } from "../src/fixtures/withExternalRuntime";
import { withFundedWallet } from "../src/fixtures/withFundedWallet";
import { withErc20Balance } from "../src/fixtures/withErc20Balance";
import type { ScenarioFundedWalletContext, ScenarioRuntimeClientsContext, ScenarioStep, ScenarioTest } from "../src/types";

const USDC_MAINNET = "0xA0b86991c6218b36c1d19D4a2e9Eb0ce3606eB48" as const;

type StepOut<S> = S extends ScenarioStep<any, infer O> ? O : never;

test("withChain output type is runtime clients context", () => {
  expectTypeOf<StepOut<ReturnType<typeof withChain>>>().toEqualTypeOf<ScenarioRuntimeClientsContext>();
});

test("withExternalRuntime output type is runtime clients context", () => {
  const runtime = {
    key: "t",
    rpcUrl: "http://127.0.0.1:8545",
    async stop() {},
  };
  expectTypeOf<StepOut<ReturnType<typeof withExternalRuntime>>>().toEqualTypeOf<ScenarioRuntimeClientsContext>();
  expectTypeOf(withExternalRuntime({ runtime })).toEqualTypeOf<ReturnType<typeof withChain>>();
});

test("withFundedWallet output type is funded wallet context", () => {
  expectTypeOf<StepOut<ReturnType<typeof withFundedWallet>>>().toEqualTypeOf<ScenarioFundedWalletContext>();
});

test("scenario(chain, test) composes to a runner and accepts ScenarioTest<ScenarioRuntimeClientsContext>", () => {
  const t: ScenarioTest<ScenarioRuntimeClientsContext> = async (_ctx) => {};
  expectTypeOf(scenario(withChain(), t)).toEqualTypeOf<() => Promise<void>>();
});

test("scenario(chain, funded, test) accepts ScenarioTest<ScenarioFundedWalletContext>", () => {
  const t: ScenarioTest<ScenarioFundedWalletContext> = async (_ctx) => {};
  expectTypeOf(scenario(withChain(), withFundedWallet({ balance: parseEther("1") }), t)).toEqualTypeOf<() => Promise<void>>();
});

test("scenario(fork, funded, erc20 without `to`, test) accepts ScenarioTest<ScenarioFundedWalletContext>", () => {
  const t: ScenarioTest<ScenarioFundedWalletContext> = async (_ctx) => {};
  expectTypeOf(
    scenario(
      withFork({ rpcUrl: "http://example.invalid", blockNumber: 1n }),
      withFundedWallet({ balance: 1n }),
      withErc20Balance({ token: USDC_MAINNET, amount: 1n }),
      t,
    ),
  ).toEqualTypeOf<() => Promise<void>>();
});

test("scenario(chain, erc20 with `to`, test) accepts ScenarioTest<ScenarioRuntimeClientsContext>", () => {
  const t: ScenarioTest<ScenarioRuntimeClientsContext> = async (_ctx) => {};
  expectTypeOf(
    scenario(
      withChain(),
      withErc20Balance({
        token: USDC_MAINNET,
        amount: 1n,
        to: "0x0000000000000000000000000000000000000002",
      }),
      t,
    ),
  ).toEqualTypeOf<() => Promise<void>>();
});

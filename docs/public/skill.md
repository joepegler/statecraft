# Statecraft setup

Use this to set up a TypeScript project for Statecraft scenarios with Vitest.

Requirements:

- anvil installed and available on PATH
- vitest dev dependency
- viem dev dependency
- @statecraft/vitest dev dependency
- optional: @pimlico/alto if you will use withBundler

Install anvil:
curl -L https://foundry.paradigm.xyz | bash

Install dependencies (choose one package manager):
bun add -D vitest viem @statecraft/vitest
or
npm install -D vitest viem @statecraft/vitest

Optional bundler dependency:
bun add -D @pimlico/alto
or
npm install -D @pimlico/alto

Optional for fork tests:

- set MAINNET_RPC_URL to a reachable HTTP RPC endpoint
- pin blockNumber as a bigint literal

Create a compile-check test file named statecraft.try.test.ts with:
import { test } from "vitest";
import { scenario, withChain } from "@statecraft/vitest";

test("statecraft setup compiles", () => {
void scenario;
void withChain;
});

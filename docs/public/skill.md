# Statecraft setup

Use this to set up a TypeScript project for Statecraft scenarios with a JavaScript test runner.

Requirements:

- anvil installed and available on PATH
- a test runner (examples below use Vitest; Jest, `node:test`, and others work if they support async test callbacks)
- viem dev dependency
- @st8craft/core dev dependency
- optional: @pimlico/alto if you will use withBundler

Install anvil:
curl -L https://foundry.paradigm.xyz | bash

Install dependencies (choose one package manager). Example with Vitest:

bun add -D vitest viem @st8craft/core
or
npm install -D vitest viem @st8craft/core

Optional bundler dependency:
bun add -D @pimlico/alto
or
npm install -D @pimlico/alto

Optional for fork tests:

- set VITE_RPC_URL to a reachable HTTP RPC endpoint
- pin blockNumber as a bigint literal
- if running fork tests on GitHub Actions, add the `Setup Foundry` step (example:
  https://github.com/joepegler/statecraft/blob/dev/.github/workflows/sdk-tests.yml#L30-L32)

Create a compile-check test file named statecraft.try.test.ts with (Vitest shown; adapt imports to your runner):

import { test } from "vitest";
import { scenario, withChain } from "@st8craft/core";

test("statecraft setup compiles", () => {
void scenario;
void withChain;
});

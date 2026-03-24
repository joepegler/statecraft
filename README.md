# Statecraft

Composable scenario runtime for Ethereum testing in Vitest.

Statecraft exists to remove repetitive Web3 integration-test boilerplate in TypeScript projects. Instead of writing one-off setup for local chains, forks, wallet funding, and deployments in every test, you compose explicit fixtures and keep test bodies focused on behavior.

## Quickstart

```ts
import { test, expect } from "vitest";
import { parseEther } from "viem";
import { scenario, withFork, withFundedWallet } from "@statecraft/vitest";

test(
  "funded wallet on mainnet fork",
  scenario(
    withFork({
      rpcUrl: process.env.MAINNET_RPC_URL!,
      blockNumber: 22_000_000n,
    }),
    withFundedWallet({
      balance: parseEther("1"),
    }),
    async ({ wallet, publicClient }) => {
      const balance = await publicClient!.getBalance({ address: wallet! });
      expect(balance).toBe(parseEther("1"));
    },
  ),
);
```

## Core Concepts

- `scenario(...steps, testFn)` composes fixtures in order and returns a Vitest-compatible async test function.
- A scenario step is explicit middleware: it receives context, adds to it, and calls `next(updatedCtx)`.
- `withChain` creates a fresh local Anvil runtime.
- `withFork` creates a pinned local fork (`rpcUrl` + `blockNumber`) for deterministic tests.
- `withContracts` injects deployed runtime bytecode at known addresses (fast setup, no constructor).
- `withDeployments` performs real deployments using creation bytecode and constructor semantics.

## Package Layout

- `packages/runtime`: runtime lifecycle (start/stop local chain or fork)
- `packages/clients`: viem `publicClient`, `walletClient`, `testClient` creation
- `packages/scenarios`: scenario engine and `withX` fixtures
- `packages/vitest`: ergonomic Vitest-facing exports
- `packages/examples`: runnable demonstrations

## Examples

Run examples:

```bash
bun install
bun test
```

Included examples in `packages/examples/examples/scenarios.test.ts`:

- fresh local chain + funded wallet
- forked mainnet + funded wallet + real contract call
- runtime bytecode injection with `withContracts`
- real deployment flow with `withDeployments`

## Documentation

This repo uses [Vocs](https://vocs.dev/) for docs.

Run docs locally:

```bash
bun run docs:dev
```

# Statecraft

Composable scenario runtime for Ethereum testing in Vitest.

Statecraft exists to remove repetitive Web3 integration-test boilerplate in TypeScript projects. Instead of writing one-off setup for local chains, forks, wallet funding, and deployments in every test file, you compose explicit fixtures and keep test bodies focused on behavior.

## When to use Statecraft

- You run Ethereum integration tests in `vitest` with `viem`.
- You want deterministic setup with explicit fixture ordering.
- You need reusable setup for funded wallets, ERC-20 state, and contracts.

## Requirements

Local execution uses [Anvil](https://book.getfoundry.sh/forge/anvil) (from [Foundry](https://book.getfoundry.sh/getting-started/installation)). Install Foundry:

```bash
curl -L https://foundry.paradigm.xyz | bash
```

After installation, `anvil` should be on your `PATH`.

## Quickstart

```ts
import { test, expect } from "vitest";
import { parseEther } from "viem";
import { scenario, withChain, withFundedWallet } from "@statecraft/vitest";

test(
  "funded wallet on local chain",
  scenario(
    withChain(),
    withFundedWallet({
      balance: parseEther("1"),
    }),
    async ({ wallet, publicClient }) => {
      const balance = await publicClient.getBalance({ address: wallet });
      expect(balance).toBe(parseEther("1"));
    },
  ),
);
```

For a forked variant (`withFork` + pinned `blockNumber`), see docs Quickstart.

## Core Concepts

- `scenario(...steps, testFn)` composes fixtures in order and returns a Vitest-compatible async test function.
- A scenario step is explicit middleware: it receives context, adds to it, and calls `next(updatedCtx)`.
- `withChain` creates a fresh local Anvil runtime.
- `withFork` creates a pinned local fork (`rpcUrl` + `blockNumber`) for deterministic tests.
- `withFundedWallet` funds a scenario wallet via the Anvil test client (optional `erc20` balances for that address).
- `withSnapshot` snapshots before inner steps and reverts in `finally` for isolation.
- `withErc20Balance` seeds ERC-20 balances on compatible local/forked nodes (test-only, not a mint).
- Typed `scenario(...)` infers `ctx` from built-in fixtures; `requireContext` helps for custom narrowing.
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
- forked mainnet + funded wallet + USDC via `withFundedWallet.erc20` or `withErc20Balance`
- runtime bytecode injection with `withContracts`
- real deployment flow with `withDeployments`

## Documentation

This repo uses [Vocs](https://vocs.dev/) for docs.

Suggested reading order:

1. Overview
2. Quickstart
3. Core Concepts
4. Migration (only when upgrading)

Run docs locally:

```bash
bun run docs:dev
```

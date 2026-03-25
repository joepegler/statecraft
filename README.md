Statecraft makes Ethereum integration tests deterministic and composable in Vitest.

Most suites start clean, then degrade into hidden setup, flaky fork state, and copy-pasted helper stacks. Statecraft gives you one explicit scenario pipeline so each test declares its environment up front.

If you already use Vitest + viem + Anvil, Statecraft is not a replacement for those tools. It is a testing primitive for composing setup safely and repeatably.

## Before vs After

Without Statecraft, setup usually lives in custom helpers plus `beforeEach`, and ordering guarantees are easy to break.

With Statecraft, setup is explicit middleware:

```ts
import { test, expect } from "vitest";
import { erc20Abi, parseEther } from "viem";
import { scenario, withFork, withFundedWallet, withErc20Balance } from "@statecraft/vitest";

const USDC_MAINNET = "0xA0b86991c6218b36c1d19D4a2e9Eb0ce3606eB48" as const;

test(
  "fork + funded wallet + USDC balance",
  scenario(
    withFork({
      rpcUrl: process.env.MAINNET_RPC_URL!,
      blockNumber: 22_000_000n,
    }),
    withFundedWallet({
      balance: parseEther("1"),
    }),
    withErc20Balance({
      token: USDC_MAINNET,
      amount: 1_000_000n, // 1 USDC (6 decimals)
    }),
    async ({ wallet, publicClient }) => {
      const usdc = await publicClient.readContract({
        address: USDC_MAINNET,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [wallet],
      });

      expect(usdc).toBe(1_000_000n);
    },
  ),
);
```

## Why Statecraft

- Deterministic by default: pin fork block numbers and keep state setup explicit.
- Composable setup: build scenarios from small `withX` steps instead of one large helper.
- Honest test context: each step extends context and passes it forward in order.

## 60-Second Quickstart

### Requirements

Local execution uses [Anvil](https://book.getfoundry.sh/forge/anvil) from [Foundry](https://book.getfoundry.sh/getting-started/installation).

```bash
curl -L https://foundry.paradigm.xyz | bash
```

Ensure `anvil` is available on your `PATH`.

### Install

```bash
bun add -D @statecraft/vitest
```

### Create a local chain scenario

```ts
import { test, expect } from "vitest";
import { scenario, withChain, withFundedWallet } from "@statecraft/vitest";

test(
  "runs a funded wallet scenario in one test",
  scenario(
    withChain(),
    withFundedWallet({
      balance: 1_000_000_000_000_000_000n, // 1 ETH in wei
    }),
    async ({ wallet, publicClient }) => {
      const balance = await publicClient.getBalance({ address: wallet });
      expect(balance).toBe(1_000_000_000_000_000_000n);
    },
  ),
);
```

## Core Primitives

- `scenario(...steps, testFn)`: composes setup steps into one Vitest-compatible test.
- `withChain()`: starts a fresh local Anvil runtime.
- `withFork({ rpcUrl, blockNumber })`: starts a pinned local fork for deterministic mainnet state.
- `withFundedWallet({ balance, erc20? })`: creates and funds a test wallet.
- `withErc20Balance({ token, amount })`: seeds ERC-20 balance on compatible local or forked nodes.
- `withSnapshot()`: snapshots before inner steps and reverts in `finally`.
- `withContracts(...)`: injects runtime bytecode at known addresses.
- `withDeployments(...)`: performs real deployments with constructor semantics.

## Use It When / Skip It When

Use Statecraft when:

- your tests need repeatable fork state
- setup is spread across helper files and hooks
- fixture ordering bugs are common

Skip Statecraft when:

- plain unit tests already cover your behavior
- your integration setup is trivial and stable
- you need a full Ethereum framework (Statecraft is not that)

## Limits and Caveats

- `withErc20Balance` is test-only balance mutation, not a mint path.
- Forks should use pinned `blockNumber` values for reproducibility.
- Some tokens and node configurations may require alternative setup strategies.

## Examples

Run examples:

```bash
bun install
bun test
```

Included examples in `packages/examples/examples/scenarios.test.ts`:

- fresh local chain plus funded wallet
- forked mainnet plus funded wallet plus real contract call
- forked mainnet plus funded wallet plus USDC via `withFundedWallet.erc20` or `withErc20Balance`
- runtime bytecode injection with `withContracts`
- real deployment flow with `withDeployments`

## Package Layout

- `packages/runtime`: runtime lifecycle for local and forked chains
- `packages/clients`: viem `publicClient`, `walletClient`, `testClient` wiring
- `packages/scenarios`: scenario engine and `withX` fixtures
- `packages/vitest`: Vitest-facing exports
- `packages/examples`: runnable scenario examples

## Documentation

This repo uses [Vocs](https://vocs.dev/) for docs.

Suggested reading order:

1. Overview
2. Quickstart
3. Core Concepts
4. Migration (only when upgrading)

For contributor and agent-assisted workflows, see [AGENTS.md](./AGENTS.md).

Run docs locally:

```bash
bun run docs:dev
```

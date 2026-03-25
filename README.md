# Statecraft

[![npm version](https://img.shields.io/npm/v/@st8craft/core.svg)](https://www.npmjs.com/package/@st8craft/core)
[![License: MIT](https://img.shields.io/npm/l/@st8craft/core)](LICENSE)
[![CI: Build (PR to main)](https://github.com/joepegler/statecraft/actions/workflows/pr-build-main.yml/badge.svg?branch=main)](https://github.com/joepegler/statecraft/actions/workflows/pr-build-main.yml)
[![@st8craft/core line coverage](https://img.shields.io/badge/%40st8craft%2Fcore%20lines-91.84%25-brightgreen)](https://github.com/joepegler/statecraft/actions/workflows/sdk-tests.yml)
[![Docs](https://img.shields.io/badge/docs-statecraft.services-2f6feb?style=flat)](https://statecraft.services)

Statecraft makes Ethereum integration tests deterministic and composable in TypeScript.

## Current maturity

Statecraft is an early-stage, 0.x SDK. Public APIs and behaviors may change between minor versions, so review the changelog before upgrading.

## Security and support

- Security reporting: see [SECURITY.md](./SECURITY.md).
- Support and questions: open an issue on GitHub: https://github.com/joepegler/statecraft/issues.
- Community expectations: see [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

## Release verification

Releases to npm are published via Changesets and include CI build and test verification.
Additionally, the publish step validates the packed tarball to ensure it contains the expected `dist/` output.

Key checks:

- `bun run build` and `vitest run` as part of CI (see [`sdk-tests.yml`](https://github.com/joepegler/statecraft/blob/main/.github/workflows/sdk-tests.yml)).
- `scripts/validate-publish-manifests.mjs` runs during the publish workflow to validate the final npm package contents (see [`publish-npm.yml`](https://github.com/joepegler/statecraft/blob/main/.github/workflows/publish-npm.yml)).

Most suites start clean, then degrade into hidden setup, flaky fork state, and copy-pasted helper stacks. Statecraft gives you one explicit scenario pipeline so each test declares its environment up front.

If you already use viem + Anvil with a JavaScript test runner, Statecraft is not a replacement for those tools. It is a testing primitive for composing setup safely and repeatably. Examples below use Vitest; `scenario(...)` returns an async function you can pass to other runners (Jest, Node `node:test`, and similar).

## Before vs After

Without Statecraft, setup usually lives in custom helpers plus `beforeEach`, and ordering guarantees are easy to break.

With Statecraft, setup is explicit middleware:

```ts
import { test, expect } from "vitest";
import { erc20Abi, parseEther } from "viem";
import {
  scenario,
  withFork,
  withFundedWallet,
  withErc20Balance,
} from "@st8craft/core";

const USDC_MAINNET = "0xA0b86991c6218b36c1d19D4a2e9Eb0ce3606eB48" as const;

test(
  "fork + funded wallet + USDC balance",
  scenario(
    withFork({
      rpcUrl: process.env.VITE_RPC_URL!,
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
bun add -D @st8craft/core
```

### Create a local chain scenario

```ts
import { test, expect } from "vitest";
import { scenario, withChain, withFundedWallet } from "@st8craft/core";

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

- `scenario(...steps, testFn)`: composes setup steps into one async test function (examples wrap it with Vitest `test`).
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
bun run test
```

Included examples in `packages/examples/examples/scenarios.test.ts`:

- fresh local chain plus funded wallet
- forked mainnet plus funded wallet plus real contract call
- forked mainnet plus funded wallet plus USDC via `withFundedWallet.erc20` or `withErc20Balance`
- runtime bytecode injection with `withContracts`
- real deployment flow with `withDeployments`

## Package Layout

- `packages/core`: published SDK (`@st8craft/core`): runtime, viem clients, scenario engine, and `withX` fixtures
- `packages/examples`: runnable scenario examples (private workspace package)

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

# AGENTS.md

Opinionated operating manual for AI coding agents working in `statecraft`.

## Purpose (What this repo is)

Statecraft is a TypeScript library (`@st8craft/core`) for composable Ethereum testing scenarios.
It aims to eliminate ad hoc setup code by replacing it with explicit, composable `withX` fixtures.
The repo and docs use Vitest by default; consumers can use other runners that support async test callbacks.

It provides clear abstractions over:

- local and forked EVM runtimes (via Anvil)
- viem clients
- test environment setup (wallets, balances, contracts, deployments)

## Core Philosophy (Non-negotiable behavior model)

1. Explicit over magical
   - Every feature/fixture must take clear inputs and produce predictable outputs.
   - Avoid hidden global state.
   - Prefer: `scenario(withFork(...), withFundedWallet(...), async (ctx) => {})`.
   - Avoid: `describeWithEverything(...)`-style implicit setup.

2. Composition is the product
   - A `scenario` is a pipeline of environment-building steps.
   - Each `withX` receives context, extends/modifies it, and passes it forward.
   - Do not break this model by sneaking in side effects or hidden ordering dependencies.

3. Honest primitives
   Do not blur these concepts. If semantics become unclear, the API is wrong:
   - `withChain`: fresh local chain
   - `withFork`: forked remote chain (pinned block)
   - `withContracts`: inject runtime bytecode
   - `withDeployments`: real contract deployment
   - `withErc20Balance`: direct state mutation (test-only)

4. Narrow scope wins
   - Do not build a general-purpose Ethereum framework or replicate Foundry/Hardhat.
   - Solve one painful problem clearly, keep APIs small and sharp.

5. Determinism matters
   - Forked chains should use pinned blocks.
   - State must be controlled explicitly.

## Repo Boundaries (Do not violate ownership)

Inside `packages/core`, keep a clear dependency direction when changing internals:
`scenarios -> clients -> runtime` (public API is flat from `@st8craft/core`).

- `src/runtime`: anvil runtime lifecycle
- `src/clients`: viem client wiring over runtime
- `src/scenarios`: scenario engine + `withX` fixtures
- `packages/examples`: private usage demos and scenario examples

If a change crosses layers, keep APIs explicit and avoid hidden coupling.

## Refactors (allowed, but behavior-safe)

Opportunistic refactors are welcome when they improve readability or align code with the fixture composition model.
Do not change observable behavior unless the task explicitly asks for behavior changes.
If a refactor could accidentally affect behavior, update/add tests.

## Fixture Design Rules (what to do when adding/updating `withX`)

When implementing a new `withX`, it must:

- accept explicit config
- extend context in a predictable way
- be composable with other fixtures

It must not:

- assume other fixtures ran unless documented
- introduce hidden coupling
- mutate unrelated parts of context

Types should guide usage:

- strongly type context where practical
- avoid overly generic or vague types
- prefer clarity over type wizardry

Fail loudly:

- errors should be early, explicit, and actionable
- include actionable context (what is missing, which config field is required, etc.)

## ERC20 Balance Handling (project-specific guidance)

- Use viem-deal internally where possible.
- Do not reimplement slot discovery as a first step.
- Clearly document:
  - this is test-only
  - it may not work for all tokens

## Bundler / AA Features (future)

Treat bundler/AA as runtime fixtures (e.g. `withBundler`) rather than one big helper.
Build small, composable pieces:

- `withBundler`
- `withSmartAccount`
- `withPaymaster`

## Multi-chain (future)

Represent as namespaced contexts:
`ctx.chains.ethereum`, `ctx.chains.base`.
Do not simulate cross-chain logic in v1.

## Development Priorities

The current "north star" is:

- `scenario` abstraction
- `withFork`
- `withFundedWallet`
- `withErc20Balance`
- the distinction between `withContracts` vs `withDeployments`
- a clean example + README

Everything else is secondary.

## Tooling Defaults

- Package manager: `bun` (workspace)
- Language: TypeScript, ESM
- Test runner: `vitest` (default in this repo; library is not Vitest-specific)
- Build tool in packages: `zile`

From repo root:

- `bun test` for full test run
- `bun run typecheck` for full workspace typecheck
- `bun run build` when changing build-facing code

For tighter loops:

- `bun --filter @st8craft/core test`
- `bun --filter @st8craft/core run typecheck`

## Agent Tooling (Prompting pattern)

If you are using an AI coding agent to write or modify scenarios, paste this prompting pattern into your agent:

```text
Agent
Human
Paste this repo's `scenario(...steps, testFn)` model into your plan:
1) Add `withChain()` for local work, or `withFork({ rpcUrl, blockNumber })` for deterministic mainnet state
2) Add `withFundedWallet(...)` to create the signer account
3) Add only the extra fixtures your test needs (`withErc20Balance`, `withContracts`, `withDeployments`, `withSnapshot`)
4) Keep fixture ordering explicit, and treat each `withX` as context middleware

When you are unsure, read this file for the fixture rules.
```

## Testing Standards (project constraints)

- Every behavior change must include or update tests.
- Keep tests colocated with implementation when practical:
  - fixture tests live next to each fixture in `packages/core/src/scenarios/fixtures` (for example `withFork.ts` with `withFork.test.ts`)
  - scenario and utility tests live beside their source files under `packages/core/src/scenarios`
  - runtime and clients integration tests live under `packages/core/tests`
- Keep tests deterministic:
  - pin fork block numbers
  - avoid wall-clock and random data unless controlled
  - avoid network assumptions not encoded in setup
- Prefer assertions on observable behavior, not implementation details.

## Coding Standards (the parts we actually care about)

- Prefer pure functions and explicit inputs/outputs.
- Keep public APIs small; add exports only when required.
- Avoid boolean flag explosion; prefer clear option objects.
- Avoid "magic" defaults that hide test setup details.
- Prefer named helpers over deeply nested inline logic.
- Use precise error messages with actionable context.

## TSDoc (public surface)

- Types meant for consumers should carry TSDoc compatible comments.
- For exported shapes in `types.ts`, write TSDoc on the type and on each field (units, semantics, nullable/optional).
- Do not define reusable `type` or `interface` aliases inside functions; move them to that folder’s `types.ts` when it improves readability.
- Exported functions and public factory/fixture entrypoints should have a short TSDoc summary.

## Website copy

- Em dashes are forbidden in public site copy (for example under `docs/`, including MDX and any strings surfaced on the docs site).
- Do not introduce the em dash character (Unicode U+2014). Prefer commas, parentheses, colons, or separate sentences instead.

## Performance and Reliability Guardrails

- Avoid repeated runtime spin-up when one scenario composition can do the job.
- Be explicit about lifecycle ownership (start/stop/cleanup).
- Ensure cleanup runs on failures, not only success paths.

## Definition of Done

A task is done when all are true:

- Requested behavior is implemented (or behavior safety preserved in case of refactors).
- Relevant tests pass (and were added/updated when needed).
- Type safety remains intact (`bun run typecheck` when applicable).
- Package boundaries are respected.
- Final handoff includes:
  - changed files
  - verification commands run
  - any assumptions or follow-ups

## If Unsure

Pick the safer option: preserve current behavior, add coverage, and surface assumptions.

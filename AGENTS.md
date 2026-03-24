# AGENTS.md

Opinionated operating manual for AI coding agents working in `statecraft`.

## Purpose

Statecraft is a TypeScript monorepo for composable Ethereum testing scenarios on Vitest.
Optimize for deterministic tests, explicit fixture composition, and small, reviewable changes.

## Non-Negotiables

1. Do not change behavior unless the task explicitly asks for behavior changes.
2. Prefer fixing root causes over patching symptoms.
3. Keep changes minimal and local to the right package.
4. Never silently weaken type safety or test assertions.
5. If assumptions are required, state them clearly in your final message.

## Repo Shape (Know Your Boundaries)

- `packages/runtime`: anvil runtime lifecycle
- `packages/clients`: viem client wiring over runtime
- `packages/scenarios`: scenario engine + `withX` fixtures
- `packages/vitest`: public ergonomic exports for tests
- `packages/examples`: usage demos and scenario examples

Boundary rule: depend "downward" only.
`vitest -> scenarios -> clients -> runtime`

If a requested change crosses layers, keep APIs explicit and avoid hidden coupling.

## Tooling Defaults

- Package manager: `bun` (workspace)
- Language: TypeScript, ESM
- Test runner: `vitest`
- Build tool in packages: `zile`

Use these commands from repo root:

- `bun test` for full test run
- `bun run typecheck` for full workspace typecheck
- `bun run build` when changing build-facing code

For tighter loops, run package-scoped scripts:

- `bun --filter @statecraft/<pkg> test`
- `bun --filter @statecraft/<pkg> run typecheck`

## Coding Standards (Opinionated)

- Prefer pure functions and explicit inputs/outputs.
- Keep public APIs small; add exports only when required.
- Avoid boolean flag explosion; prefer clear option objects.
- Avoid "magic" defaults that hide test setup details.
- Prefer named helpers over deeply nested inline logic.
- Use precise error messages that include actionable context.

## Documentation (TSDoc)

- Types meant for consumers should carry **TSDoc compatible** comments.
- For exported shapes in `types.ts`, write **TSDoc on the type and on each field** (units, semantics, nullable or optional behavior). Example:

```ts
/**
 * Row shape returned by `some_view_mv`.
 */
export type SomeRow = {
  /** Primary key of the row. */
  some_id: bigint;
  /** Amount in USD (string because SQL may return `text` / numeric). */
  amount_usd: string | null;
  /** Timestamp of last update (UTC). */
  updated_at: Date | null;
};
```

- Do not define reusable `type` / `interface` aliases inside functions (e.g. `type WalletRow = ...` inside a function body). **Move them to that folder’s `types.ts`** and import them. **Exception:** truly one-off, non-exported shapes used once that do not improve readability when lifted.
- Exported functions and public factory/fixture entrypoints should have a short TSDoc summary (what it does, ordering/deps if non-obvious).

## Testing Standards

- Every behavior change must include or update tests.
- Add tests close to the changed package unless the behavior is truly cross-package.
- Keep tests deterministic:
  - pin fork block numbers
  - avoid wall-clock and random data unless controlled
  - avoid network assumptions not encoded in setup
- Prefer assertions on observable behavior, not implementation details.

## Dependency and API Hygiene

- Reuse existing workspace packages before adding dependencies.
- Do not introduce new dependencies unless clearly justified by the task.
- Keep dependency direction aligned with package boundaries.
- Avoid re-export chains that make ownership unclear.

## Performance and Reliability Guardrails

- Avoid repeated runtime spin-up when one scenario composition can do the job.
- Be explicit about lifecycle ownership (start/stop/cleanup).
- Ensure cleanup runs on failures, not only success paths.

## Change Workflow (Default)

1. Read relevant package(s) and existing tests first.
2. Implement the smallest correct change.
3. Run targeted tests for touched package(s).
4. Run `bun run typecheck` if types or public APIs changed.
5. Run broader tests when change spans packages.
6. Report what changed, why, and how it was verified.

## What to Avoid

- Broad refactors mixed with feature work.
- "Drive-by" formatting churn in unrelated files.
- Introducing compatibility shims without clear need.
- Catch-all `try/catch` that hides failures.
- Test-only fixes that mask real production bugs.

## Definition of Done

A task is done when all are true:

- Requested behavior is implemented.
- Relevant tests pass (and were added/updated when needed).
- Type safety remains intact (`bun run typecheck` when applicable).
- Package boundaries are respected.
- Final handoff includes:
  - changed files
  - verification commands run
  - any assumptions or follow-ups

## If Unsure

Pick the safer option: preserve current behavior, add coverage, and surface assumptions.

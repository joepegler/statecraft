# Contributing

Thank you for your interest in Statecraft.
This document covers the basics of how to propose changes, run tests, and ship updates.

## Development setup

Statecraft is a TypeScript monorepo using `bun` for development and `vitest` for tests.

From the repo root:

```bash
bun install
```

## Testing and typechecking

Common commands:

- `bun test` (run the full test suite)
- `bun run typecheck` (typecheck the workspace)
- `bun run build` (build packages)

For faster loops, you can run the core package only:

- `bun --filter @st8craft/core test`
- `bun --filter @st8craft/core run typecheck`

## Submitting changes

1. Create a branch.
2. Make your changes.
3. Add or update tests when behavior changes.
4. Open a pull request.

We use Changesets to manage releases:

- Create a changeset with `bun changeset`

## Release notes

When your change affects public behavior or public APIs, include a changeset so the
release notes are accurate and users can plan upgrades.

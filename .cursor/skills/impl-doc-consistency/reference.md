# Fixture Consistency Reference

## Expected doc file shape

Each fixture page should keep these sections in order:

1. Title and one-line description (frontmatter)
2. Signature heading (`##` with `withX(...)`)
3. `### Why it is useful`
4. `### Example`
5. `### Options` table
6. `### Adds to context`
7. `### Context requirements`
8. `### Lifecycle`
9. `### Notes and caveats`

## Current fixture surface (core)

- `withChain`
- `withFork`
- `withExternalRuntime`
- `withMultiChain`
- `withSnapshot`
- `withFundedWallet`
- `withImpersonation`
- `withErc20Balance`
- `withContracts`
- `withDeployments`
- `withBundler`
- `withBridge`

## Terminology conventions

- **Runtime keying:** use `chainKey`
- **Chain selection in chain-scoped fixtures:** use `chain`
- **Context map:** `ctx.chains[<key>]`
- **Client aliases:** `publicClient`, `altPublicClient`
- **Chain clients:** `publicClient`, `walletClient`, `testClient`
- **Modes:** `runtimeMode` with `"chain"` or `"fork"`

## Naming note

Config types are typically `WithXConfig`.

Current exception in implementation:

- `withImpersonationConfig` (lowercase leading `w`)

If this remains intentional, docs and exports should keep it consistent and avoid introducing a conflicting type name.

---
name: impl-doc-consistency
description: Enforce consistency between fixture implementation in packages/core/src and documentation in docs/pages by checking names, options, context fields, and lifecycle semantics. Use when adding or editing withX fixtures, updating fixture docs, or reviewing terminology drift across implementation and docs.
---

# Implementation-Documentation Consistency (Statecraft)

Use this skill to keep `packages/core/src` and `docs/pages` aligned for fixture APIs, terminology, and behavior.

## Scope

Focus on fixture parity across:

- `packages/core/src/scenarios/fixtures/with*.ts`
- `docs/pages/fixtures/**/with*.mdx`

## Canonical Rule

Treat implementation as source of truth for executable behavior.

Allowed exceptions:

- Docs can be clearer than code comments.
- Docs can add examples and caveats not present in code.
- If docs intentionally diverge from implementation, explicitly state why in the docs.

## Core Checks

For each `withX` fixture:

1. **Existence parity**
   - Every `withX.ts` has a matching `withX.mdx`.
   - Every `withX.mdx` maps to a real fixture.

2. **API signature parity**
   - Function name and call shape match.
   - Config option names match.
   - Required vs optional options match.

3. **Context parity**
   - Docs "Adds to context" section matches properties actually written to context.
   - Docs "Context requirements" match runtime prerequisites in code.

4. **Lifecycle parity**
   - Docs "Lifecycle" and caveats match startup/teardown behavior in code (`start`, `stop`, `finally`, ownership rules).

5. **Terminology parity**
   - Keep terms stable across code and docs:
     - `chainKey` for runtime keying
     - `chain` for chain selection in chain-scoped wallet/token fixtures
     - `runtimeMode`, `publicClient`, `altPublicClient`, `walletClient`, `testClient`
   - Avoid introducing synonyms for the same concept.

## Workflow

1. Build a quick fixture inventory from implementation and docs.
2. Compare each `withX` pair for API signature, options, context, lifecycle, and terms.
3. Fix docs first when code is correct.
4. Fix implementation if docs reveal an actual API bug.
5. Re-check the full fixture set once after edits.
6. Summarize any intentional deviations.

## Output Format

When applying this skill, produce:

```markdown
## Consistency Report
- Fixture coverage: X/Y implemented fixtures documented
- Missing docs: ...
- Orphan docs: ...
- Option mismatches: ...
- Terminology mismatches: ...
- Lifecycle/context mismatches: ...

## Changes Made
- ...

## Remaining Risks
- ...
```

## References

- [Fixture consistency reference](reference.md)

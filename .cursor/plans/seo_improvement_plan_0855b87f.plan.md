---
name: SEO Improvement Plan
overview: Improve Statecraft’s docs and repo discoverability by addressing technical SEO in the Vocs site, strengthening homepage/page copy, and adding package/repository metadata that search engines, social scrapers, and package consumers rely on.
todos:
  - id: audit-vocs-seo-hooks
    content: Confirm the cleanest Vocs-compatible way to add canonical, OG/Twitter tags, and static crawl assets.
    status: pending
  - id: add-page-frontmatter
    content: Add page-specific titles and descriptions to all existing docs pages.
    status: pending
  - id: rewrite-homepage-copy
    content: Improve homepage copy and internal linking for keyword coverage and clearer search intent matching.
    status: pending
  - id: add-crawl-share-assets
    content: Add or wire robots/sitemap/OG/favicons through docs build output.
    status: pending
  - id: add-package-metadata
    content: Add consistent description/homepage/repository metadata to publishable packages and root manifest.
    status: pending
  - id: verify-built-head
    content: Build docs and verify generated HTML contains the expected SEO tags and assets.
    status: pending
isProject: false
---

# SEO Improvement Plan

## Current Findings

- `[vocs.config.ts](vocs.config.ts)` currently sets only `title`, `description`, and `basePath`. The built homepage shows a `<title>` plus partial OG/Twitter tags, but no canonical URL, no `meta description`, no `og:description`, no `og:url`, and no project-owned OG image setup.
- `[docs/pages/index.mdx](docs/pages/index.mdx)`, `[docs/pages/quickstart.mdx](docs/pages/quickstart.mdx)`, and `[docs/pages/core-concepts.mdx](docs/pages/core-concepts.mdx)` have no frontmatter, so page-specific titles/descriptions are not being emitted.
- The homepage copy is accurate but thin: it explains what Statecraft is, but does not target likely search phrases such as Ethereum testing, Vitest, viem, Anvil forks, scenario-based integration testing, or deterministic EVM tests.
- No repo-owned `robots.txt`, `sitemap.xml`, or structured data were found. Package manifests under `[packages/runtime/package.json](packages/runtime/package.json)`, `[packages/clients/package.json](packages/clients/package.json)`, `[packages/scenarios/package.json](packages/scenarios/package.json)`, and `[packages/vitest/package.json](packages/vitest/package.json)` also lack `description`, `homepage`, and `repository` metadata.

## Proposed Work

### 1. Strengthen global docs SEO

- Update `[vocs.config.ts](vocs.config.ts)` to add the missing SEO primitives Vocs supports: `baseUrl`, `titleTemplate`, `ogImageUrl`, and `head` tags for canonical, Open Graph, and Twitter metadata.
- Keep GitHub Pages compatibility by preserving `basePath`, and add a separate environment-driven `baseUrl` for production canonical URLs.
- If the repository URL is available from existing repo metadata, wire `editLink` and `socials` so the docs surface stronger trust and ownership signals.

### 2. Add page-level metadata and improve information scent

- Add frontmatter to all docs pages with page-specific `title` and `description` values in:
  - `[docs/pages/index.mdx](docs/pages/index.mdx)`
  - `[docs/pages/quickstart.mdx](docs/pages/quickstart.mdx)`
  - `[docs/pages/core-concepts.mdx](docs/pages/core-concepts.mdx)`
- Rewrite the homepage copy to better answer “what is Statecraft,” “who is it for,” and “why use it over hand-rolled test setup,” while keeping behavior unchanged.
- Expand internal linking from the homepage into the highest-value pages so crawlers and users reach the core concepts faster.

### 3. Add missing crawl/share assets

- Add repo-owned docs assets under the docs static/public area if Vocs supports them directly in this project layout: `robots.txt`, a stable social preview image or OG route configuration, and favicon/logo assets if currently absent.
- If Vocs does not generate a sitemap in this version, add a lightweight build-time or checked-in sitemap approach scoped to the current docs routes.
- Add minimal JSON-LD only if it can be done cleanly through Vocs `head` without creating brittle framework-specific glue.

### 4. Improve package and repository discoverability

- Add high-signal package metadata to the publishable package manifests:
  - `[packages/runtime/package.json](packages/runtime/package.json)`
  - `[packages/clients/package.json](packages/clients/package.json)`
  - `[packages/scenarios/package.json](packages/scenarios/package.json)`
  - `[packages/vitest/package.json](packages/vitest/package.json)`
- Add or tighten root-level project metadata in `[package.json](package.json)` where helpful.
- Align the package descriptions with the docs homepage language so search, npm metadata, and repo messaging reinforce the same keywords and positioning.

### 5. Verify generated output

- Rebuild the docs and inspect the generated HTML for:
  - canonical tag present
  - meta description present on every page
  - OG/Twitter title/description/image/url tags present
  - correct absolute URLs under GitHub Pages base path
  - `robots.txt` and `sitemap.xml` emitted or copied as expected
- Run a quick type/build verification after manifest/config changes.

## Likely Files Touched

- `[vocs.config.ts](vocs.config.ts)`
- `[docs/pages/index.mdx](docs/pages/index.mdx)`
- `[docs/pages/quickstart.mdx](docs/pages/quickstart.mdx)`
- `[docs/pages/core-concepts.mdx](docs/pages/core-concepts.mdx)`
- `[package.json](package.json)`
- `[packages/runtime/package.json](packages/runtime/package.json)`
- `[packages/clients/package.json](packages/clients/package.json)`
- `[packages/scenarios/package.json](packages/scenarios/package.json)`
- `[packages/vitest/package.json](packages/vitest/package.json)`
- Possibly new docs static asset files for `robots.txt`, sitemap support, favicon/logo, or OG image assets depending on the cleanest Vocs-compatible approach.

## Assumptions

- Scope is limited to repo-local/docs-site SEO, not live production indexing diagnostics.
- We will avoid behavior changes outside docs/build/metadata and keep the change set local to documentation and package metadata.
- If a canonical production URL is not already encoded in the repo, we should introduce it as an explicit env/config value rather than hardcoding a guessed GitHub Pages URL.

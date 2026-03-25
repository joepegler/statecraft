import path from "node:path";
import { fileURLToPath } from "node:url";
import * as React from "react";
// Import `defineConfig` from the config module, not `from "vocs"`: the package entry re-exports the dev server,
// which creates a circular dependency while Vite loads this file and can leave `vocs dev` stuck with no output.
import { defineConfig } from "./node_modules/vocs/_lib/config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SITE_DESCRIPTION =
  "Statecraft helps TypeScript teams ship deterministic Ethereum integration tests: compose Anvil-style runtimes, pinned forks, funded wallets, and contract setup with explicit scenario steps instead of per-file chain boilerplate. Examples use Vitest; the same patterns work with other test runners.";

const CODE_REPOSITORY = "https://github.com/joepegler/statecraft";

const envBasePath = process.env.BASE_PATH?.trim();

const basePath =
  envBasePath && envBasePath !== "/"
    ? envBasePath.startsWith("/")
      ? envBasePath
      : `/${envBasePath}`
    : "/";

const DOCS_ORIGIN = "https://statecraft.services";
const docsBaseUrl = `${DOCS_ORIGIN}${basePath}`.replace(/\/+$/, "");
const baseUrl = `${docsBaseUrl}/`;

function canonicalHref(docsBase: string, location: string): string {
  const base = docsBase.replace(/\/+$/, "");
  const normalized =
    location === "/" || location === "" ? "/" : location.replace(/\/+$/, "");
  return normalized === "/" ? `${base}/` : `${base}${normalized}/`;
}

const pageSocial: Record<
  string,
  { twitterTitle: string; twitterDescription: string }
> = {
  "/": {
    twitterTitle: "Statecraft: viem + Anvil Ethereum integration testing",
    twitterDescription:
      "Compose pinned forks, funded wallets, and contract fixtures with scenario steps. Deterministic EVM tests in TypeScript without repeated Anvil setup. Vitest examples; other runners supported.",
  },
  "/quickstart": {
    twitterTitle: "Quickstart – Statecraft",
    twitterDescription:
      "Install Statecraft, run tests with Bun, and compose a forked-mainnet scenario with withFork and withFundedWallet. Examples use Vitest.",
  },
  "/overview": {
    twitterTitle: "Overview – Statecraft",
    twitterDescription:
      "How scenario composition, typed context, and fixtures like withChain, withFork, withFundedWallet, and withSnapshot fit together in Statecraft.",
  },
  "/fixtures/runtime": {
    twitterTitle: "Runtime source fixtures – Statecraft",
    twitterDescription:
      "Choose withChain, withFork, or withExternalRuntime to provide the runtime and viem clients a scenario needs.",
  },
  "/fixtures/wallets": {
    twitterTitle: "Wallets & balance fixtures – Statecraft",
    twitterDescription:
      "Fund the scenario account with withFundedWallet, optionally seed ERC-20 balances for that wallet.",
  },
  "/fixtures/tokens": {
    twitterTitle: "Tokens & ERC-20 fixtures – Statecraft",
    twitterDescription:
      "Seed ERC-20 balances in test state with withErc20Balance, including recipient selection via `to`.",
  },
  "/fixtures/contracts": {
    twitterTitle: "Contracts & deployment fixtures – Statecraft",
    twitterDescription:
      "Inject runtime bytecode with withContracts or deploy contracts with constructor semantics via withDeployments.",
  },
  "/fixtures/isolation": {
    twitterTitle: "Isolation fixtures – Statecraft",
    twitterDescription:
      "Keep tests independent when reusing runtimes with withSnapshot snapshot-and-revert isolation.",
  },
};

export default defineConfig({
  title: "Statecraft",
  description: SITE_DESCRIPTION,
  titleTemplate: "%s – Statecraft",
  logoUrl: "/logo.png",
  // Vite SSR resolves react-router(-dom) to the Node "default" CJS build, which breaks
  // named ESM imports. Alias to the published .mjs entries (same as the "import" condition).
  vite: {
    resolve: {
      alias: [
        {
          find: /^react-router-dom$/,
          replacement: path.join(
            __dirname,
            "node_modules/react-router-dom/dist/index.mjs",
          ),
        },
        {
          find: /^react-router$/,
          replacement: path.join(
            __dirname,
            "node_modules/react-router/dist/development/index.mjs",
          ),
        },
      ],
    },
  },
  twoslash: {
    compilerOptions: {
      baseUrl: __dirname,
      paths: {
        "@st8craft/core": ["packages/core/src/index.ts"],
      },
      strict: true,
    },
  },
  basePath,
  baseUrl,
  theme: {
    accentColor: "#38bdf8",
    variables: {
      color: {
        background: { light: "#f8fafc", dark: "#0b1120" },
        background2: { light: "#f1f5f9", dark: "#111827" },
        background3: { light: "#e2e8f0", dark: "#1e293b" },
        border: { light: "#e2e8f0", dark: "#1f2937" },
        text: { light: "#0f172a", dark: "#e2e8f0" },
        text2: { light: "#475569", dark: "#94a3b8" },
        title: { light: "#020617", dark: "#f8fafc" },
      },
    },
  },
  iconUrl: "/logo.png",
  ogImageUrl:
    "https://vocs.dev/api/og?logo=%logo&title=%title&description=%description",
  sidebar: [
    {
      text: "Introduction",
      items: [
        { text: "Overview", link: "/overview" },
        { text: "Quickstart", link: "/quickstart" },
      ],
    },
    {
      text: "Fixtures",
      items: [
        {
          text: "Runtime Source",
          link: "/fixtures/runtime",
          items: [
            { text: "withChain", link: "/fixtures/runtime/withChain" },
            { text: "withFork", link: "/fixtures/runtime/withFork" },
            {
              text: "withExternalRuntime",
              link: "/fixtures/runtime/withExternalRuntime",
            },
            { text: "withBundler", link: "/fixtures/runtime/withBundler" },
          ],
        },
        {
          text: "Wallets & Accounts",
          link: "/fixtures/wallets",
          items: [
            {
              text: "withFundedWallet",
              link: "/fixtures/wallets/withFundedWallet",
            },
          ],
        },
        {
          text: "Tokens & Assets",
          link: "/fixtures/tokens",
          items: [
            {
              text: "withErc20Balance",
              link: "/fixtures/tokens/withErc20Balance",
            },
          ],
        },
        {
          text: "Contracts",
          link: "/fixtures/contracts",
          items: [
            {
              text: "withContracts",
              link: "/fixtures/contracts/withContracts",
            },
            {
              text: "withDeployments",
              link: "/fixtures/contracts/withDeployments",
            },
          ],
        },
        {
          text: "Isolation",
          link: "/fixtures/isolation",
          items: [
            { text: "withSnapshot", link: "/fixtures/isolation/withSnapshot" },
          ],
        },
      ],
    },
  ],
  head({ path }) {
    const docsBase = docsBaseUrl.replace(/\/+$/, "");

    const locationKey = path.replace(/\/+$/, "") || "/";
    const href = canonicalHref(docsBase, locationKey);
    const social = pageSocial[locationKey] ?? pageSocial["/"];

    const structuredData = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Statecraft",
      description: SITE_DESCRIPTION,
      url: `${docsBase}/`,
    };

    const softwareSourceData =
      locationKey === "/"
        ? {
            "@context": "https://schema.org",
            "@type": "SoftwareSourceCode",
            name: "Statecraft",
            description: SITE_DESCRIPTION,
            programmingLanguage: "TypeScript",
            codeRepository: CODE_REPOSITORY,
            url: `${docsBase}/`,
          }
        : null;

    const jsonLd = JSON.stringify(structuredData);
    const softwareJsonLd = softwareSourceData
      ? JSON.stringify(softwareSourceData)
      : null;

    return React.createElement(
      React.Fragment,
      null,
      React.createElement("link", { rel: "canonical", href }),
      React.createElement("meta", {
        name: "twitter:title",
        content: social.twitterTitle,
      }),
      React.createElement("meta", {
        name: "twitter:description",
        content: social.twitterDescription,
      }),
      React.createElement("script", {
        type: "application/ld+json",
        dangerouslySetInnerHTML: { __html: jsonLd },
      }),
      softwareJsonLd
        ? React.createElement("script", {
            type: "application/ld+json",
            dangerouslySetInnerHTML: { __html: softwareJsonLd },
          })
        : null,
    );
  },
});

import path from "node:path";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { defineConfig } from "vocs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SITE_DESCRIPTION =
  "Composable Ethereum integration-test scenarios for TypeScript: Vitest + viem + Anvil-style runtimes, pinned forks, and explicit fixtures—without per-test boilerplate.";

const envBasePath = process.env.BASE_PATH?.trim();

const basePath =
  envBasePath && envBasePath !== "/"
    ? envBasePath.startsWith("/")
      ? envBasePath
      : `/${envBasePath}`
    : "/";

const docsBaseUrlRaw = process.env.DOCS_BASE_URL?.trim();
const baseUrl =
  docsBaseUrlRaw && docsBaseUrlRaw.length > 0
    ? `${docsBaseUrlRaw.replace(/\/+$/, "")}/`
    : undefined;

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
    twitterTitle: "Statecraft",
    twitterDescription: SITE_DESCRIPTION,
  },
  "/quickstart": {
    twitterTitle: "Quickstart – Statecraft",
    twitterDescription:
      "Install Statecraft, run tests with Bun, and compose a forked-mainnet Vitest scenario with withFork and withFundedWallet.",
  },
  "/core-concepts": {
    twitterTitle: "Core concepts – Statecraft",
    twitterDescription:
      "How scenario composition, middleware-style steps, and runtimes (withChain, withFork, withContracts, withDeployments) fit together in Statecraft.",
  },
};

export default defineConfig({
  title: "Statecraft",
  description: SITE_DESCRIPTION,
  titleTemplate: "%s – Statecraft",
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
      strict: true,
    },
  },
  basePath,
  baseUrl,
  iconUrl: "/icon.svg",
  ogImageUrl:
    "https://vocs.dev/api/og?logo=%logo&title=%title&description=%description",
  sidebar: [
    {
      text: "Getting Started",
      items: [
        { text: "Overview", link: "/" },
        { text: "Quickstart", link: "/quickstart" },
      ],
    },
    {
      text: "Guides",
      items: [{ text: "Core Concepts", link: "/core-concepts" }],
    },
  ],
  head({ path }) {
    const docsBase = docsBaseUrlRaw?.replace(/\/+$/, "");
    if (!docsBase) return null;

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

    const jsonLd = JSON.stringify(structuredData);

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
    );
  },
});

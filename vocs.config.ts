import { defineConfig } from "vocs";

const envBasePath = process.env.BASE_PATH?.trim();

const basePath =
  envBasePath && envBasePath !== "/"
    ? envBasePath.startsWith("/")
      ? envBasePath
      : `/${envBasePath}`
    : "/";

export default defineConfig({
  title: "Statecraft",
  description:
    "Composable scenario runtime for Ethereum testing in Vitest.",
  basePath,
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
});

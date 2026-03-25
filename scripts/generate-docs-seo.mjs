/**
 * Writes crawl assets into docs/public before `vocs build`.
 * Hardcodes the docs origin, and uses `BASE_PATH` to handle hosting under subpaths.
 *
 * The origin is fixed to `https://statecraft.services` and `BASE_PATH` is provided by
 * `.github/workflows/docs-pages.yml` (or locally).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../docs/public");
const DOCS_ORIGIN = "https://statecraft.services";
const envBasePath = process.env.BASE_PATH?.trim();
const basePath =
  envBasePath && envBasePath !== "/"
    ? envBasePath.startsWith("/")
      ? envBasePath
      : `/${envBasePath}`
    : "/";

const base = `${DOCS_ORIGIN}${basePath}`.replace(/\/+$/, "");
const routes = [
  "/",
  "/quickstart",
  "/skill",
  "/overview",
  "/fixtures/runtime",
  "/fixtures/wallets",
  "/fixtures/tokens",
  "/fixtures/contracts",
  "/fixtures/isolation",
];

fs.mkdirSync(publicDir, { recursive: true });

let robots = `User-agent: *
Allow: /
`;

if (base) {
  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = routes
    .map((route) => {
      const loc = route === "/" ? `${base}/` : `${base}${route}/`;
      const priority = route === "/" ? "1.0" : "0.8";
      return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
    })
    .join("\n");

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
  fs.writeFileSync(path.join(publicDir, "sitemap.xml"), sitemap);
  robots += `Sitemap: ${base}/sitemap.xml
`;
} else {
  try {
    fs.unlinkSync(path.join(publicDir, "sitemap.xml"));
  } catch {
    /* no stale file */
  }
}

fs.writeFileSync(path.join(publicDir, "robots.txt"), robots);

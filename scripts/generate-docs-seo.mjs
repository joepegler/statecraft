/**
 * Writes crawl assets into docs/public before `vocs build`.
 * Set DOCS_BASE_URL to the public docs origin + path (no trailing slash), e.g.
 * https://octocat.github.io/statecraft
 *
 * When using a GitHub Pages custom domain, `docs/public/CNAME` drives CI: the workflow
 * sets DOCS_BASE_URL to `https://<domain>` and BASE_PATH to `/`.
 * In CI this is set in `.github/workflows/docs-pages.yml`. When unset, robots.txt
 * is still emitted; sitemap.xml is omitted.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../docs/public");
const baseRaw = process.env.DOCS_BASE_URL?.trim();
const base = baseRaw ? baseRaw.replace(/\/+$/, "") : "";
const routes = ["/", "/quickstart", "/core-concepts"];

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

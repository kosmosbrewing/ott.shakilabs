import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SITE_URL,
  SERVICE_SLUG,
  getSitemapRoutes,
  loadPriceSeed,
} from "./seo-routes.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_PATH = path.resolve(__dirname, "../public/sitemap.xml");

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function makeUrlNode(route, options = {}) {
  const loc = `${SITE_URL}${route}`;
  const lastmod = options.lastmod || undefined;
  const changefreq = options.changefreq || "weekly";
  const priority = options.priority || "0.7";

  return [
    "  <url>",
    `    <loc>${escapeXml(loc)}</loc>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    ...(lastmod ? [`    <lastmod>${escapeXml(lastmod)}</lastmod>`] : []),
    "  </url>",
  ].join("\n");
}

function main() {
  const seed = loadPriceSeed();
  const lastmod =
    typeof seed?.lastUpdated === "string" && seed.lastUpdated
      ? seed.lastUpdated.slice(0, 10)
      : new Date().toISOString().slice(0, 10);

  // Per-route crawl hints. Country routes are absent from getSitemapRoutes()
  // because they canonicalize to the service page (see seo-routes.mjs).
  const ROUTE_CONFIG = {
    "/": { priority: "1.0", changefreq: "weekly" },
    "/about": { priority: "0.5", changefreq: "monthly" },
    "/privacy": { priority: "0.4", changefreq: "monthly" },
    "/terms": { priority: "0.4", changefreq: "monthly" },
    [`/${SERVICE_SLUG}`]: { priority: "0.9", changefreq: "daily" },
    [`/${SERVICE_SLUG}/trends`]: { priority: "0.8", changefreq: "daily" },
  };

  const nodes = getSitemapRoutes().map((route) => {
    const config = ROUTE_CONFIG[route] || { priority: "0.7", changefreq: "weekly" };
    // The site root is advertised without a trailing slash so that the sitemap
    // loc matches the canonical emitted by prerender.mjs exactly.
    return makeUrlNode(route === "/" ? "" : route, { ...config, lastmod });
  });

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...nodes,
    "</urlset>",
    "",
  ].join("\n");

  fs.writeFileSync(OUTPUT_PATH, xml, "utf-8");
  process.stdout.write(
    `[sitemap] generated ${nodes.length} urls -> ${path.relative(process.cwd(), OUTPUT_PATH)}\n`
  );
}

main();

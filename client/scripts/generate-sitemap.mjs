import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SITE_URL,
  SERVICE_SLUG,
  getCountryRoutes,
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

  const nodes = [
    makeUrlNode("", { priority: "1.0", changefreq: "weekly", lastmod }),
    makeUrlNode("/about", { priority: "0.5", changefreq: "monthly", lastmod }),
    makeUrlNode("/privacy", { priority: "0.4", changefreq: "monthly", lastmod }),
    makeUrlNode("/terms", { priority: "0.4", changefreq: "monthly", lastmod }),
    makeUrlNode(`/${SERVICE_SLUG}`, {
      priority: "0.9",
      changefreq: "daily",
      lastmod,
    }),
    makeUrlNode(`/${SERVICE_SLUG}/trends`, {
      priority: "0.8",
      changefreq: "daily",
      lastmod,
    }),
    ...getCountryRoutes().map((route) =>
      makeUrlNode(route, { priority: "0.7", changefreq: "daily", lastmod })
    ),
  ];

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

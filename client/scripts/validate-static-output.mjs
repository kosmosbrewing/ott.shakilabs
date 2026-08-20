/**
 * Static output gate for the prerendered build.
 *
 * Runs after prerender.mjs and fails the build when dist/ drifts from what the
 * route table promises. Collect every violation and report them together
 * before exiting: seeing how many kinds of defect exist at once is what tells
 * you the scope of the fix, whereas throwing on the first one hides the rest.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SITE_URL,
  getAllPrerenderRoutes,
  getSitemapRoutes,
  getCountryRoutes,
  canonicalPathFor,
} from "./seo-routes.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, "../dist");

const failures = [];
function assert(condition, message) {
  if (!condition) failures.push(message);
}

function routeToFile(route) {
  return route === "/"
    ? path.join(DIST_DIR, "index.html")
    : path.join(DIST_DIR, route.replace(/^\//, ""), "index.html");
}

function urlFor(route) {
  return route === "/" ? SITE_URL : `${SITE_URL}${route}`;
}

function canonicalOf(html) {
  const match = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i);
  return match ? match[1] : null;
}

function titleOf(html) {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i);
  return match ? match[1].trim() : "";
}

const prerenderRoutes = getAllPrerenderRoutes();
const sitemapRoutes = getSitemapRoutes();
const countryRoutes = getCountryRoutes();
const countryRouteSet = new Set(countryRoutes);
// Route set membership is what makes the internal-link check safe: cross-app
// footer links (/finance, /card, ...) legitimately have no /ott prefix, so
// only this app's own routes may be flagged.
const ownRouteSet = new Set(prerenderRoutes);

const titlesByRoute = new Map();

function validateRoute(route) {
  const file = routeToFile(route);
  // Country routes are absent from the sitemap but must still exist on disk:
  // without a static file the SPA shell would be served, which is a soft-404.
  if (!fs.existsSync(file)) {
    failures.push(`Missing static output for ${route}: ${path.relative(DIST_DIR, file)}`);
    return;
  }

  const html = fs.readFileSync(file, "utf-8");

  const expectedCanonical = urlFor(canonicalPathFor(route));
  assert(
    canonicalOf(html) === expectedCanonical,
    `Canonical mismatch for ${route}: expected ${expectedCanonical}, got ${canonicalOf(html)}`
  );

  const ogUrl = html.match(/<meta\s+property="og:url"\s+content="([^"]*)"/i)?.[1] ?? null;
  assert(
    ogUrl === expectedCanonical,
    `og:url must equal canonical for ${route}: expected ${expectedCanonical}, got ${ogUrl}`
  );

  const h1Count = html.match(/<h1\b/gi)?.length ?? 0;
  assert(h1Count === 1, `Expected exactly 1 <h1> in ${route}, found ${h1Count}`);

  // The SPA shell's generic <noscript> fallback must not survive into a
  // prerendered page: it carries the same heading and copy on every route.
  assert(
    !/<noscript>/i.test(html),
    `Shell <noscript> fallback leaked into prerendered output for ${route}`
  );

  assert(
    /<article data-seo-prerender/i.test(html) || /<div data-seo-prerender/i.test(html),
    `Prerendered body content missing for ${route}`
  );

  // Internal links written without the router base ("/privacy" instead of
  // "/ott/privacy") resolve to the wrong host path in static HTML.
  for (const match of html.matchAll(/<a\s+[^>]*href="(\/[^"#?]*)/gi)) {
    const href = match[1].replace(/\/$/, "") || "/";
    if (ownRouteSet.has(href)) {
      failures.push(`Unprefixed internal link in ${route}: href="${href}" (missing /ott base)`);
    }
  }

  titlesByRoute.set(route, titleOf(html));
}

// lastmod is the one field in this file with no visible symptom when it breaks:
// the sitemap stays well-formed and the loc set stays correct while every URL
// quietly advertises a frozen date (it sat on the price seed's 2026-02-20 for
// five months). So assert it against the ledger that produced it — a future
// rewiring back to a clock or a data field fails here instead of in Search
// Console six weeks later.
function validateLastmod(xml, locCount) {
  // tUrl is an xsd:sequence in the sitemaps.org 0.9 schema, so child order is
  // normative. Assert it here because a reordering regression produces a file
  // that still looks fine to every human reader.
  for (const block of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const order = [...block[1].matchAll(/<(loc|lastmod|changefreq|priority)>/g)].map((m) => m[1]);
    const expectedOrder = ["loc", "lastmod", "changefreq", "priority"];
    assert(
      JSON.stringify(order) === JSON.stringify(expectedOrder),
      `Sitemap <url> children must follow the xsd:sequence ${expectedOrder.join(" -> ")}, got ${order.join(" -> ")}`
    );
  }

  const values = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
  assert(
    values.length === locCount,
    `Every sitemap URL needs exactly one <lastmod>: ${locCount} locs, ${values.length} lastmods`
  );

  const today = new Date().toISOString().slice(0, 10);
  for (const value of values) {
    assert(
      /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)),
      `Sitemap lastmod must be an ISO date (YYYY-MM-DD), got "${value}"`
    );
    // A future date is the one error Google treats as a reason to distrust the
    // whole file, and it is what a timezone-naive stamp produces.
    assert(value <= today, `Sitemap lastmod is in the future: ${value} > ${today}`);
  }

  const ledgerPath = path.resolve(__dirname, "../sitemap-lastmod.json");
  if (!fs.existsSync(ledgerPath)) {
    failures.push("client/sitemap-lastmod.json is missing (generate-sitemap.mjs writes it)");
    return;
  }
  const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf-8")).routes ?? {};
  const expected = sitemapRoutes.map((route) => ledger[route]?.lastmod ?? null);
  assert(
    JSON.stringify(values) === JSON.stringify(expected),
    "Sitemap lastmod must come from the content ledger, not a clock or a data field.\n" +
      `  ledger: ${JSON.stringify(expected)}\n  sitemap: ${JSON.stringify(values)}`
  );
}

function validateSitemap() {
  const sitemapPath = path.join(DIST_DIR, "sitemap.xml");
  if (!fs.existsSync(sitemapPath)) {
    failures.push("dist/sitemap.xml is missing");
    return;
  }

  const xml = fs.readFileSync(sitemapPath, "utf-8");
  const actual = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const expected = sitemapRoutes.map(urlFor);

  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `Sitemap must list exactly the self-canonical routes.\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`
  );

  validateLastmod(xml, actual.length);

  const variantUrls = new Set(countryRoutes.map(urlFor));
  const leaked = actual.filter((url) => variantUrls.has(url));
  assert(
    leaked.length === 0,
    `Sitemap must not list canonicalized country variants: ${leaked.join(", ")}`
  );

  // A sitemap entry whose canonical points elsewhere sends mixed signals.
  for (const route of sitemapRoutes) {
    assert(
      canonicalPathFor(route) === route,
      `Sitemap route ${route} is not self-canonical (canonical -> ${canonicalPathFor(route)})`
    );
  }
}

function validateTitles() {
  const byTitle = new Map();
  for (const [route, title] of titlesByRoute) {
    // Consolidated variants share the service page's audience on purpose;
    // only self-canonical routes compete with each other in the index.
    if (canonicalPathFor(route) !== route) continue;
    if (!byTitle.has(title)) byTitle.set(title, []);
    byTitle.get(title).push(route);
  }
  for (const [title, routes] of byTitle) {
    assert(
      routes.length === 1,
      `Duplicate <title> across indexable routes ${routes.join(", ")}: "${title}"`
    );
  }
}

function validateNotFound() {
  const notFoundPath = path.join(DIST_DIR, "404.html");
  if (!fs.existsSync(notFoundPath)) return;
  const html = fs.readFileSync(notFoundPath, "utf-8");
  assert(
    /name="robots"\s+content="noindex/i.test(html),
    "404.html must be noindex"
  );
}

assert(prerenderRoutes[0] === "/", "Root alias must remain prerendered");
assert(
  countryRoutes.every((route) => prerenderRoutes.includes(route)),
  "Every country variant must stay in the prerender list (soft-404 guard)"
);
assert(
  countryRoutes.every((route) => !sitemapRoutes.includes(route)),
  "Country variants must not be advertised in the sitemap"
);
assert(
  !countryRouteSet.has("/youtube-premium/trends"),
  "/youtube-premium/trends is independent content and must never be treated as a country variant"
);

prerenderRoutes.forEach(validateRoute);
validateSitemap();
validateTitles();
validateNotFound();

if (failures.length > 0) {
  process.stderr.write(`\n[validate-static-output] ${failures.length} problem(s):\n`);
  for (const failure of failures) {
    process.stderr.write(`  - ${failure}\n`);
  }
  process.stderr.write("\n");
  process.exit(1);
}

process.stdout.write(
  `[validate-static-output] ok — ${prerenderRoutes.length} prerendered routes ` +
    `(${sitemapRoutes.length} in sitemap + ${countryRoutes.length} canonicalized variants)\n`
);

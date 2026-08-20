/**
 * Crawler-visible content signature for a prerendered page.
 *
 * Shared by generate-sitemap.mjs (which stamps <lastmod>) and by the historical
 * dating pass that seeded the ledger, so both judge "did this page change?"
 * by exactly the same rule.
 *
 * What counts as content: the title, the meta description, the route's own
 * prerendered body block, and the JSON-LD. What deliberately does NOT count:
 *
 *  - hashed asset URLs (`index.C4k_EJm4.js`) — they churn on every build, so
 *    including them would make lastmod a build clock again, which is the exact
 *    false signal this file exists to avoid.
 *  - the shared header/footer blocks — site chrome is identical on all 6 URLs,
 *    so a nav or footer tweak would move every lastmod at once and tell Google
 *    six pages changed when no page's own content did.
 *  - CSS custom properties and component classes — a contrast fix repaints the
 *    page but leaves the indexable text identical; a recrawl would find nothing
 *    new.
 */
import crypto from "node:crypto";

// The route's own body block. prerender.mjs emits <article data-seo-prerender="…">
// for rich routes and a <div data-seo-prerender> fallback otherwise; header and
// footer use their own tags and are skipped by construction.
const MAIN_BLOCK_PATTERNS = [
  /<article\s+data-seo-prerender[\s\S]*?<\/article>/i,
  /<div\s+data-seo-prerender[\s\S]*?<\/div>/i,
];

function firstMatch(html, patterns) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[0];
  }
  return "";
}

// Whitespace-only reflows (a reindent in the generator) are not content
// changes, so normalise before hashing.
function normalize(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

export function extractContentSignature(html) {
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const description =
    html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1] ?? "";
  const main = firstMatch(html, MAIN_BLOCK_PATTERNS);
  const jsonLd = [
    ...html.matchAll(
      /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
    ),
  ].map((match) => match[1]);

  return [
    `title:${normalize(title)}`,
    `description:${normalize(description)}`,
    `main:${normalize(main)}`,
    ...jsonLd.map((block, index) => `jsonld[${index}]:${normalize(block)}`),
  ].join("\n");
}

export function hashContentSignature(html) {
  return crypto
    .createHash("sha256")
    .update(extractContentSignature(html), "utf-8")
    .digest("hex")
    .slice(0, 16);
}

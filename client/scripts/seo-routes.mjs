import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SITE_URL = "https://shakilabs.com/ott";
export const SERVICE_SLUG = "youtube-premium";

const PRICE_DATA_PATH = path.resolve(
  __dirname,
  "../../data/prices/youtube-premium.json"
);

export function loadPriceSeed() {
  const raw = fs.readFileSync(PRICE_DATA_PATH, "utf-8");
  return JSON.parse(raw);
}

export function getCountryEntries() {
  const seed = loadPriceSeed();
  const prices = Array.isArray(seed?.prices) ? seed.prices : [];

  return prices
    .map((row) => {
      const countryCode = String(row?.countryCode || "").toLowerCase();
      const country = String(row?.country || "").trim();
      // KRW 국가는 환율 변환 없이 원본 가격 사용 (USD→KRW 재변환 오차 방지)
      const isKrw = String(row?.currency || "").toUpperCase() === "KRW";
      const krw = isKrw
        ? Number(row?.plans?.individual?.monthly)
        : Number(row?.converted?.individual?.krw);
      if (!countryCode || !country) return null;
      return {
        countryCode,
        country,
        krw: Number.isFinite(krw) ? Math.round(krw) : null,
      };
    })
    .filter(Boolean);
}

export function getStaticRoutes() {
  return [
    "/",
    "/about",
    "/privacy",
    "/terms",
    "/community",
    `/${SERVICE_SLUG}`,
    `/${SERVICE_SLUG}/trends`,
  ];
}

export function getCountryRoutes() {
  return getCountryEntries().map((entry) => `/${SERVICE_SLUG}/${entry.countryCode}`);
}

// Routes that are advertised to crawlers. Country routes are deliberately
// absent: they are doorway-grade duplicates of each other (worst observed pair
// /ie vs /nl scored 0.976 similarity across all 1,035 pairs -- only the price
// figures and the currency change, the prose is one template), so they
// canonicalize to the service page instead of competing with it. Listing a URL
// that immediately points elsewhere just wastes crawl budget.
//
// This is reversible: once a country page grows genuinely unique content
// (local payment rules, market-specific commentary), drop it from
// COUNTRY_ROUTE_SET below and it returns to the sitemap as self-canonical.
// `/community` is prerendered but stays out of the sitemap as before: it is a
// listing shell for user posts, not standalone content.
export function getSitemapRoutes() {
  return [
    "/",
    "/about",
    "/privacy",
    "/terms",
    `/${SERVICE_SLUG}`,
    `/${SERVICE_SLUG}/trends`,
  ];
}

// 라우트별 크롤 힌트. generate-sitemap.mjs가 아니라 여기 사는 이유: 라우트 목록의
// 사본이 하나 늘어날 때마다 드리프트가 생긴다(house는 같은 구조에서 /jeonse-risk가
// priority 기본값 0.5로 나갔다 — 형제는 0.8인데). 사이트맵 라우트와 같은 파일에 두고
// 아래 게이트가 키 집합이 정확히 일치하는지 양방향으로 검사한다.
//
// 기본값은 일부러 없다. 미선언 라우트에 0.7을 조용히 물리면 "우선순위를 정한 적 없음"과
// "0.7로 정함"이 구분되지 않고, 잘못된 값이 아무 신호 없이 배포된다.
const ROUTE_CRAWL_HINTS = {
  "/": { priority: "1.0", changefreq: "weekly" },
  "/about": { priority: "0.5", changefreq: "monthly" },
  "/privacy": { priority: "0.4", changefreq: "monthly" },
  "/terms": { priority: "0.4", changefreq: "monthly" },
  [`/${SERVICE_SLUG}`]: { priority: "0.9", changefreq: "daily" },
  [`/${SERVICE_SLUG}/trends`]: { priority: "0.8", changefreq: "daily" },
};

export function getCrawlHintRoutes() {
  return Object.keys(ROUTE_CRAWL_HINTS);
}

export function getCrawlHint(route) {
  const hint = ROUTE_CRAWL_HINTS[route];
  if (!hint) {
    throw new Error(
      `[seo-routes] ${route}에 크롤 힌트(priority·changefreq)가 선언돼 있지 않다. ` +
        "seo-routes.mjs의 ROUTE_CRAWL_HINTS에 추가하라 — 기본값으로 조용히 내보내지 않는다."
    );
  }
  return hint;
}

// Set membership, not a path-shape test: `/youtube-premium/trends` also lives
// one segment under the service slug but is independent content (0.16
// similarity vs country pages, 3,456 chars), so it must never be treated as a
// country variant. Only codes that exist in the price seed qualify.
function getCountryRouteSet() {
  return new Set(getCountryRoutes());
}

// Canonical target for a prerendered route: country variants point at the
// service page (e.g. /youtube-premium/ie -> /youtube-premium), everything else
// (including /youtube-premium/trends and "/") stays self-canonical.
export function canonicalPathFor(route) {
  return getCountryRouteSet().has(route) ? `/${SERVICE_SLUG}` : route;
}

// Country routes stay prerendered on purpose: with no static HTML file the
// SPA shell would be served for these URLs, which reads as a soft-404 to
// crawlers. Never drop them from the prerender list -- consolidation removes
// them from the sitemap only.
export function getAllPrerenderRoutes() {
  return [...getStaticRoutes(), ...getCountryRoutes()];
}

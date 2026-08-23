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
import { getCrawlHintRoutes } from "./seo-routes.mjs";
import { parseRouterRoutes, expandRoute, buildServeMatcher } from "./router-routes.mjs";
import { findUngeneratedUtilities } from "./validate-utilities.mjs";

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
    return null;
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

  return actual;
}

// 사이트맵에서 빠져도 되는 라우터 라우트. 목록이 아니라 사유가 본체다 — 새 라우트를
// 여기 적어 게이트를 조용히 통과시키는 걸 막으려면, 빠진 이유가 무엇인지가 코드에
// 남아 있어야 한다. 여기 적힌 라우트도 (a) 라우터가 실제로 서빙하고 (b) 정적 파일이
// 존재하며 (c) 사이트맵에 없어야 한다는 세 조건을 아래에서 다시 검사받는다.
const SITEMAP_EXEMPT = new Map([
  [
    "/community",
    "사용자 글 목록 셸이다. 자체 콘텐츠가 없고 개별 글은 X-Robots-Tag noindex라, " +
      "프리렌더는 하되(셸이 뜨면 소프트 404) 크롤러에 광고하지 않는다.",
  ],
]);

/**
 * 라우터 ↔ 사이트맵 양방향 대조.
 *
 * 정방향: 라우터가 서빙하는 정적 URL은 사이트맵에 광고돼야 한다. 200을 주고
 * 프리렌더도 멀쩡한데 sitemap.xml에만 없는 페이지는 크롤러에게 존재하지 않는
 * 것과 같고, 빌드의 어떤 단계도 이를 눈치채지 못한다.
 *
 * 역방향: 사이트맵은 라우터가 서빙하지 않는 URL을 광고해선 안 되고, 리다이렉트
 * 라우트는 절대 실려선 안 된다(자기 페이지가 없으니 대상으로 canonical된다).
 * 정방향만 보면 홈을 리다이렉트로 되돌리면서 URL은 사이트맵에 남겨두는 상태를
 * 통과시키는데, 이는 이 게이트가 잡으려던 결함보다 더 나쁜 상태다.
 *
 * 44개 국가 변종은 열린 파라미터(`:countryCode([A-Za-z]{2})`)라 유한 URL로 펼쳐지지
 * 않는다. 이들은 canonical 통합 대상이라 사이트맵에 없는 게 정상이고, 위쪽
 * 통합 검사가 따로 책임진다 — 여기서 미광고라고 오탐하지 않는다.
 */
function validateRouterSitemapParity(sitemapUrls) {
  if (!sitemapUrls) return;
  const advertised = new Set(sitemapUrls);

  let routerRoutes;
  try {
    routerRoutes = parseRouterRoutes();
  } catch (error) {
    // 폴백 없음: 파싱이 깨지면 빈 집합을 통과시키는 대신 크게 실패한다.
    failures.push(`${error.message}`);
    return;
  }

  const indexRoute = routerRoutes.find((route) => route.path === "/");
  assert(indexRoute, "src/router/index.ts must register an index route");
  assert(
    !indexRoute?.redirect,
    "Index route must render its own view: a redirect home canonicalizes to its target, " +
      "and a page whose canonical points elsewhere cannot be listed in the sitemap"
  );

  // 유한하게 펼쳐지는 라우트만이 사이트맵이 다룰 수 있는 정적 URL이다.
  const servedUrls = new Set();
  for (const route of routerRoutes) {
    const urls = expandRoute(route.path);
    if (!urls) continue;

    for (const url of urls) {
      if (route.redirect) {
        assert(
          !advertised.has(urlFor(url)),
          `Redirect route must not be listed in the sitemap: ${url} -> ${urlFor(url)}`
        );
        continue;
      }
      servedUrls.add(url);
      if (SITEMAP_EXEMPT.has(url)) continue;
      assert(
        advertised.has(urlFor(url)),
        `Router serves ${url} but the sitemap does not advertise ${urlFor(url)}`
      );
    }
  }

  assert(servedUrls.size > 0, "src/router/index.ts: no static routes were extracted");

  // 역방향: 서빙하는 라우트가 없는 사이트맵 URL은 없어야 한다.
  const servedFullUrls = new Set([...servedUrls].map(urlFor));
  for (const url of advertised) {
    assert(servedFullUrls.has(url), `Sitemap advertises a URL the router does not serve: ${url}`);
  }

  // 면제는 살아 있어야 한다. 사이트맵에 다시 실렸거나 라우터에서 사라진 면제는
  // 목록에 남은 채로 통과하며 다음 사람에게 거짓 사유를 물려준다.
  for (const [route, reason] of SITEMAP_EXEMPT) {
    assert(reason.length > 0, `Sitemap exemption for ${route} must carry a reason`);
    assert(servedUrls.has(route), `Stale sitemap exemption: the router no longer serves ${route}`);
    assert(
      !advertised.has(urlFor(route)),
      `Stale sitemap exemption: ${route} is advertised in the sitemap after all`
    );
    assert(
      prerenderRoutes.includes(route),
      `Exempt route ${route} must stay prerendered: serving the SPA shell there is a soft-404`
    );
  }

  // 세 번째 방향: 프리렌더한 파일에는 그 URL을 렌더하는 라우터 라우트가 있어야 한다.
  // 캐치올(NotFound)은 매처에서 빠져 있으므로, 라우터가 모르는 URL에 정적 파일만
  // 깔아두면(하이드레이션 즉시 404 화면으로 바뀐다) 여기서 걸린다.
  const serves = buildServeMatcher(routerRoutes);
  for (const route of prerenderRoutes) {
    assert(
      serves(route),
      `Prerendered ${route} has no router route behind it: the SPA would render NotFound after hydration`
    );
  }

  return serves;
}

// 라우트 목록의 "부수 사본"들을 라우터·사이트맵과 대조한다.
//
// 왜: 사이트맵 등재 여부만 보면 같은 드리프트가 옆 목록으로 번진 걸 놓친다. house는
// 라우트 목록이 라우터·SEO_ROUTES·priority 표·llms.txt 네 곳에 사본으로 있었는데
// 대조가 없어서 /jeonse-risk가 priority 기본값 0.5(형제는 0.8)로 나가고 llms.txt에서도
// 빠져 있었다. 사본을 줄이는 게 1순위고(크롤 힌트는 seo-routes.mjs로 옮겼다),
// 못 줄이는 사본은 여기서 양방향으로 묶는다.
function validateRouteSideLists(serves) {
  // ① 크롤 힌트 표 <-> 사이트맵 라우트: 키 집합이 정확히 같아야 한다.
  const hinted = new Set(getCrawlHintRoutes());
  for (const route of sitemapRoutes) {
    assert(hinted.has(route), `Sitemap route ${route} has no crawl hint (priority·changefreq) declared`);
  }
  for (const route of hinted) {
    assert(
      sitemapRoutes.includes(route),
      `Crawl hint declared for ${route}, which is not in the sitemap — stale entry`
    );
  }

  // ② llms.txt <-> 라우터·사이트맵.
  const publicPath = path.resolve(__dirname, "../public/llms.txt");
  const distPath = path.join(DIST_DIR, "llms.txt");
  if (!fs.existsSync(publicPath) || !fs.existsSync(distPath)) {
    failures.push("llms.txt is missing from public/ or dist/");
    return;
  }
  const llms = fs.readFileSync(publicPath, "utf-8");
  assert(
    llms === fs.readFileSync(distPath, "utf-8"),
    "dist/llms.txt differs from public/llms.txt — the shipped copy is stale"
  );

  // 절대 URL과 괄호 안 상대 경로(주요 국가 목록) 둘 다 걷는다.
  const linked = new Set();
  for (const [, tail] of llms.matchAll(/https:\/\/shakilabs\.com\/ott([^\s)\]]*)/g)) {
    linked.add(tail.replace(/\/$/, "") || "/");
  }
  for (const [, p] of llms.matchAll(/\((\/[a-z0-9][a-z0-9/-]*)\)/g)) {
    linked.add(p.replace(/\/$/, "") || "/");
  }

  for (const route of linked) {
    assert(serves(route), `llms.txt advertises ${route}, which the router does not serve`);
  }
  for (const route of sitemapRoutes) {
    assert(linked.has(route), `Sitemap route ${route} is absent from llms.txt`);
  }
}

// 소스에 적힌 색 유틸리티가 실제 CSS 규칙이 됐는가 (validate-utilities.mjs 참고).
function validateGeneratedUtilities() {
  const missing = findUngeneratedUtilities({
    srcDir: path.resolve(__dirname, "../src"),
    cssDir: path.join(DIST_DIR, "assets"),
  });
  assert(
    missing.length === 0,
    "이 색 유틸리티는 CSS로 생성되지 않았다 — Tailwind opacity 스케일(5·10·20·25…) 밖 값이면 " +
      "임의값 문법(/[12%])을 쓰고, 색 이름은 테마에 있는 것인지 확인하라:\n    " +
      missing.map(({ cls, file }) => `${cls}  (${file})`).join("\n    ")
  );
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
const serves = validateRouterSitemapParity(validateSitemap());
// serves가 없으면 라우터 파싱이 이미 실패한 것이다. 부수 목록 검사는 그 위에 얹혀
// 있으므로 폴백으로 이어가지 않는다 — 실패는 위에서 이미 기록됐다.
if (serves) validateRouteSideLists(serves);
validateGeneratedUtilities();
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
    `(${sitemapRoutes.length} in sitemap + ${countryRoutes.length} canonicalized variants), ` +
    `router<->sitemap parity both ways\n`
);

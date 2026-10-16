// 색인 소거 게이트(2026-10-16, 사용자 승인: 계산기 33 + 가이드 8 noindex): 빌드 산출물에서
//  - 사이트맵 URL ⇔ robots noindex 없음 + self-canonical
//  - 사이트맵 밖 + self-canonical(변형 아님) ⇔ noindex 있음  (404는 제외)
//  - scripts/seo-routes.mjs의 NOINDEX_ROUTES 전부가 dist에 있고 noindex를 단다 (목록과 산출물의 드리프트 차단)
// 소스 두 곳(뷰의 <SEOHead noindex>와 seo-routes의 목록)이 어긋나면 여기서 멈춘다.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function htmlFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) htmlFiles(full, out);
    else if (name.endsWith(".html")) out.push(full);
  }
  return out;
}

export function validateNoindex({ distRoot, siteUrl, noindexRoutes, sitemapPath }) {
  const sitemapXml = readFileSync(sitemapPath ?? resolve(distRoot, "sitemap.xml"), "utf8");
  const sitemap = new Set([...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/\/$/, "")));
  assert(sitemap.size > 0, "sitemap has no URLs");
  const base = siteUrl.replace(/\/$/, "");
  const problems = [];
  const seen = new Set();
  let checked = 0;
  for (const file of htmlFiles(distRoot)) {
    const rel = relative(distRoot, file);
    if (rel === "404.html") continue;
    const route = "/" + rel.replace(/index\.html$/, "").replace(/\.html$/, "").replace(/\/$/, "");
    const url = base + (route === "/" ? "" : route);
    const html = readFileSync(file, "utf8");
    const canonical = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1]?.replace(/\/$/, "");
    const noindex = /<meta name="robots" content="[^"]*noindex[^"]*"/i.test(html);
    const inSitemap = sitemap.has(url);
    const selfCanonical = !canonical || canonical === url;
    checked += 1;
    seen.add(route);
    if (inSitemap && noindex) problems.push(`${route}: in sitemap but noindex`);
    if (inSitemap && !selfCanonical) problems.push(`${route}: in sitemap but canonical → ${canonical}`);
    if (!inSitemap && selfCanonical && !noindex) problems.push(`${route}: not in sitemap, self-canonical, no noindex`);
    if (!selfCanonical && noindex) problems.push(`${route}: canonicalized variant must not carry noindex`);
  }
  for (const route of noindexRoutes) {
    assert(seen.has(route), `NOINDEX route not built: ${route}`);
    assert(!sitemap.has(base + route), `NOINDEX route still in sitemap: ${route}`);
  }
  assert(problems.length === 0, `noindex/sitemap drift:\n  ${problems.slice(0, 20).join("\n  ")}`);
  return checked;
}

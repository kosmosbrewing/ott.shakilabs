import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SITE_URL,
  SERVICE_SLUG,
  getAllPrerenderRoutes,
  getCountryEntries,
  canonicalPathFor,
} from "./seo-routes.mjs";
import { buildPrerenderHeader, buildPrerenderFooter } from "./prerender-layout.mjs";
import { buildRichContent, getFaqItems } from "./prerender-content.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, "../dist");
const DIST_INDEX = path.resolve(DIST_DIR, "index.html");

function updateMetaTag(html, selector, content) {
  const escapedContent = String(content)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  const pattern = new RegExp(`(<meta\\s+${selector}\\s+content=\")[^\"]*(\"\\s*\\/?>)`, "i");
  if (pattern.test(html)) {
    return html.replace(pattern, `$1${escapedContent}$2`);
  }
  return html.replace("</head>", `    <meta ${selector} content="${escapedContent}" />\n  </head>`);
}

function updateCanonicalLink(html, href) {
  const escapedHref = String(href)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  const tag = `<link rel="canonical" href="${escapedHref}" />`;
  const pattern = /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i;
  if (pattern.test(html)) {
    return html.replace(pattern, tag);
  }
  return html.replace("</head>", `    ${tag}\n  </head>`);
}

function updateTitle(html, title) {
  return html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);
}

function injectJsonLd(html, jsonLd) {
  // </script> 문자열이 JSON 값에 포함되면 HTML이 깨지므로 이스케이프 처리
  const safeJson = JSON.stringify(jsonLd).replace(/<\/script>/gi, "<\\/script>");
  const script = `<script type="application/ld+json">${safeJson}<\/script>`;
  return html.replace("</head>", `  ${script}\n  </head>`);
}

// FAQ 화면 HTML(<strong> 등)을 스키마용 순수 텍스트로 변환 — 보이는 문구와 동일해야 함
function toPlainText(html) {
  return String(html)
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// 화면에 FAQ가 보이는 페이지에만 FAQPage JSON-LD를 정확히 1개 생성.
// body의 data-seo-prerender 요소로 주입되므로 앱 마운트 시 removePrerenderFallback()이
// 본문 FAQ와 함께 제거해 런타임(useSEO) FAQPage와 중복되지 않는다.
function buildFaqJsonLdScript(faqItems) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: toPlainText(item.q),
      acceptedAnswer: { "@type": "Answer", text: toPlainText(item.a) },
    })),
  };
  const safeJson = JSON.stringify(jsonLd).replace(/<\/script>/gi, "<\\/script>");
  return `<script data-seo-prerender="faq-jsonld" type="application/ld+json">${safeJson}<\/script>`;
}

function buildFallbackHtml(meta) {
  return [
    '<section style="max-width:920px;margin:0 auto;padding:20px 16px;color:#111;line-height:1.6;">',
    `  <h1 style="font-size:28px;line-height:1.3;margin:0 0 12px;">${meta.heading}</h1>`,
    `  <p style="margin:0 0 10px;">${meta.description}</p>`,
    '  <p style="margin:0;color:#555;">이 페이지는 자바스크립트 비활성 환경용 SEO/GEO 요약 콘텐츠입니다.</p>',
    "</section>",
  ].join("\n");
}

function routeToMeta(route, countryMap) {
  const youtubePremiumMeta = {
    title: "유튜브 프리미엄 글로벌 가격 비교 · 나라별 구독료 최저가 순위",
    description:
      // ServicePriceView.vue의 SEO_MAP과 같은 문자열이어야 한다(둘이 갈리면 크롤러와 화면이 다른 설명을 본다).
      "유튜브 프리미엄(YouTube Premium) 국가별·나라별 구독료를 한눈에 비교. 최저가 국가 순위와 한국 대비 절약률. 요금 조사일과 환율 기준일을 함께 표기합니다.",
    heading: "유튜브 프리미엄 국가별·나라별 가격 비교",
  };

  const defaultMeta = {
    title: "OTT 구독료 국가별 가격 비교 | 유튜브 프리미엄·넷플릭스 나라별 최저가",
    description:
      "유튜브 프리미엄(YouTube Premium), 넷플릭스 등 OTT 서비스 국가별·나라별 구독료를 현재 환율 기준으로 비교. 최저가 국가 순위와 절약률.",
    heading: "OTT 서비스 국가별·나라별 구독료 가격 비교",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "OTT 구독료 국가별 가격 비교",
      url: `${SITE_URL}${route}`,
    },
  };

  if (route === "/about") {
    return {
      title: "소개 | 유튜브 프리미엄 가격 비교",
      // AboutView.vue의 useSEO description과 같은 문자열이어야 한다.
      // 이 자리에 있던 "갱신 주기를 안내합니다"는 존재하지 않는 주기를 예고했다.
      description:
        "유튜브 프리미엄 가격 비교 서비스의 데이터 출처와 요금 조사일·환율 기준일 표기 방식을 안내합니다.",
      heading: "서비스 소개",
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "AboutPage",
        name: "서비스 소개",
        url: `${SITE_URL}${route}`,
      },
    };
  }

  if (route === "/privacy") {
    return {
      title: "개인정보처리방침 | 유튜브 프리미엄 가격 비교",
      description: "유튜브 프리미엄 가격 비교 서비스 개인정보처리방침",
      heading: "개인정보처리방침",
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "개인정보처리방침",
        url: `${SITE_URL}${route}`,
      },
    };
  }

  if (route === "/terms") {
    return {
      title: "이용약관 | OTT 가격 비교",
      description: "OTT Watcher 서비스 이용약관입니다. 서비스 이용 조건, 데이터 정확성, 광고 안내 등을 확인하세요.",
      heading: "이용약관",
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "이용약관",
        url: `${SITE_URL}${route}`,
      },
    };
  }

  if (route === "/community") {
    return {
      title: "커뮤니티 | OTT 가격 비교",
      description: "OTT 가격 정보 공유 커뮤니티",
      heading: "커뮤니티",
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "커뮤니티",
        url: `${SITE_URL}${route}`,
      },
    };
  }

  // The site root is the service directory / methodology hub, not a second copy
  // of the YouTube Premium price table. Its title, description and body must
  // stay distinct from /youtube-premium or the two compete as duplicates.
  if (route === "/") {
    return {
      title: "OTT 구독료 국가별 가격 비교 | 유튜브 프리미엄·넷플릭스 나라별 최저가",
      description:
        "OTT 구독료를 국가별로 비교하는 방법과 기준을 안내합니다. 비교 대상 서비스, 환율 환산 방식, 요금제 용어를 확인하고 원하는 서비스의 나라별 가격표로 이동하세요.",
      heading: "OTT 구독료 국가별 가격 비교",
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "OTT 구독료 국가별 가격 비교",
        url: SITE_URL,
      },
    };
  }

  if (route === `/${SERVICE_SLUG}`) {
    return {
      ...youtubePremiumMeta,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "유튜브 프리미엄 글로벌 가격 비교",
        url: `${SITE_URL}${route}`,
      },
    };
  }

  if (route === `/${SERVICE_SLUG}/trends`) {
    return {
      title: "유튜브 프리미엄 국가별 가격 격차 · 최저가 순위 | OTT 가격 비교",
      description:
        "유튜브 프리미엄 국가별 구독료를 같은 시점 기준으로 비교. 최저가·절약률 순위, 대륙별 평균, 원화 환산 시 주의할 점. 실시간 시세·가격 변동 시계열은 제공하지 않습니다.",
      heading: "유튜브 프리미엄 국가별 가격 격차",
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "유튜브 프리미엄 국가별 가격 격차",
        url: `${SITE_URL}${route}`,
      },
    };
  }

  if (route.startsWith(`/${SERVICE_SLUG}/`) && route.length > `/${SERVICE_SLUG}/`.length) {
    const code = route.split("/").at(-1) || "";
    const country = countryMap.get(code);
    const countryName = country?.country || code.toUpperCase();
    const krwText = country?.krw != null ? `월 ₩${Intl.NumberFormat("ko-KR").format(country.krw)}` : "국가 상세 요금";
    return {
      title: `유튜브 프리미엄 ${countryName} 가격 · 나라별 구독료 비교 | OTT 가격 비교`,
      description: `유튜브 프리미엄 ${countryName} ${krwText} 정보를 확인하고 한국 대비 절약 여부를 비교하세요. 국가별 요금제 상세 가격 비교.`,
      heading: `${countryName} 유튜브 프리미엄 가격`,
      jsonLd: {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "홈",
                item: `${SITE_URL}/`,
              },
              {
                "@type": "ListItem",
                position: 2,
                name: "유튜브 프리미엄",
                item: `${SITE_URL}/${SERVICE_SLUG}`,
              },
              {
                "@type": "ListItem",
                position: 3,
                name: countryName,
                item: `${SITE_URL}${route}`,
              },
            ],
          },
        ],
      },
    };
  }

  return defaultMeta;
}

function routeToOgImage(route) {
  // /youtube-premium/:code → /og/youtube-premium/:code.png
  // 단, 국가 코드는 반드시 2자리 알파벳 — "trends" 같은 경로는 서비스 OG 이미지로 fallback
  if (route.startsWith(`/${SERVICE_SLUG}/`) && route.length > `/${SERVICE_SLUG}/`.length) {
    const code = route.split("/").at(-1) || "";
    if (/^[a-z]{2}$/.test(code)) {
      return `${SITE_URL}/og/v2/${SERVICE_SLUG}/${code}.png`;
    }
    return `${SITE_URL}/og/v2/${SERVICE_SLUG}.png`;
  }
  // /youtube-premium → /og/v2/youtube-premium.png
  // 루트는 서비스 허브이므로 서비스 전용 OG가 아닌 기본 OG를 쓴다
  if (route === `/${SERVICE_SLUG}`) {
    return `${SITE_URL}/og/v2/${SERVICE_SLUG}.png`;
  }
  // 그 외 (about, privacy, community 등) — 기본 OG 이미지
  return `${SITE_URL}/og-image.png`;
}

function buildRouteHtml(templateHtml, route, countryMap) {
  const meta = routeToMeta(route, countryMap);
  const ogImage = routeToOgImage(route);

  let html = templateHtml;
  // canonical / og:url must agree, so both derive from the same resolved path.
  // Country variants resolve to the service page (doorway consolidation);
  // every other route, /youtube-premium/trends included, resolves to itself.
  const canonicalRoute = canonicalPathFor(route);
  const canonicalUrl = canonicalRoute === "/" ? SITE_URL : `${SITE_URL}${canonicalRoute}`;
  html = updateTitle(html, meta.title);
  html = updateMetaTag(html, 'name="description"', meta.description);
  html = updateCanonicalLink(html, canonicalUrl);
  html = updateMetaTag(html, 'property="og:title"', meta.title);
  html = updateMetaTag(html, 'property="og:description"', meta.description);
  html = updateMetaTag(html, 'property="og:url"', canonicalUrl);
  html = updateMetaTag(html, 'property="og:image"', ogImage);
  // og:image:width/height — 없으면 og:image 태그 바로 뒤에 삽입
  if (!html.includes('property="og:image:width"')) {
    html = html.replace(
      /(<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>)/i,
      '$1\n    <meta property="og:image:width" content="1200" />\n    <meta property="og:image:height" content="630" />'
    );
  }
  html = updateMetaTag(html, 'name="twitter:title"', meta.title);
  html = updateMetaTag(html, 'name="twitter:description"', meta.description);
  html = updateMetaTag(html, 'name="twitter:image"', ogImage);
  html = injectJsonLd(html, meta.jsonLd);

  // 기존 prerender 요소 제거 (재빌드 대비)
  html = html.replace(/\n?\s*<header data-seo-prerender[\s\S]*?<\/header>/i, "");
  html = html.replace(/\n?\s*<article data-seo-prerender[\s\S]*?<\/article>/i, "");
  html = html.replace(/\n?\s*<footer data-seo-prerender[\s\S]*?<\/footer>/i, "");
  html = html.replace(/\n?\s*<div data-seo-prerender[\s\S]*?<\/div>/i, "");
  html = html.replace(/\n?\s*<script data-seo-prerender[\s\S]*?<\/script>/i, "");

  // index.html ships a generic <noscript> fallback for the SPA shell. Every
  // prerendered page already carries route-specific plain HTML that renders
  // without JS, so keeping the shell block would duplicate the same generic
  // heading and paragraph across all routes -- it produced a second <h1> on
  // 51/51 pages and identical boilerplate text sitewide. Only the prerendered
  // build strips it; client/index.html keeps the block so `vite dev` and any
  // non-prerendered entry still degrade gracefully without JS.
  html = html.replace(/\n?\s*<noscript>[\s\S]*?<\/noscript>/i, "");

  // 리치 콘텐츠 우선 시도 → 없으면 기본 fallback
  const rich = buildRichContent(route);
  const mainContent = rich || `<div data-seo-prerender>${buildFallbackHtml(meta)}</div>`;
  const headerHtml = buildPrerenderHeader();
  const footerHtml = buildPrerenderFooter();

  // FAQ가 화면에 보이는 라우트에만 FAQPage 스키마 1개 — Q&A 없는 페이지는 주입 금지
  const faqItems = getFaqItems(route);
  const faqJsonLdHtml = faqItems.length > 0 ? buildFaqJsonLdScript(faqItems) : "";

  const injection = `${headerHtml}${mainContent}${faqJsonLdHtml}${footerHtml}`;

  if (html.includes('<div id="app"></div>')) {
    html = html.replace(
      '<div id="app"></div>',
      `<div id="app"></div>${injection}`
    );
  } else {
    html = html.replace("</body>", `${injection}\n  </body>`);
  }

  return html;
}

function toOutputPath(route) {
  if (route === "/") return DIST_INDEX;
  const withoutSlash = route.replace(/^\//, "");
  return path.join(DIST_DIR, withoutSlash, "index.html");
}

function main() {
  if (!fs.existsSync(DIST_INDEX)) {
    throw new Error(`dist/index.html not found: ${DIST_INDEX}`);
  }

  const template = fs.readFileSync(DIST_INDEX, "utf-8");
  const countryMap = new Map(getCountryEntries().map((entry) => [entry.countryCode, entry]));
  const routes = getAllPrerenderRoutes();

  for (const route of routes) {
    const outPath = toOutputPath(route);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const html = buildRouteHtml(template, route, countryMap);
    fs.writeFileSync(outPath, html, "utf-8");
  }

  process.stdout.write(`[prerender] generated ${routes.length} routes in dist\n`);
}

main();

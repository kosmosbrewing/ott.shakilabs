import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SITE_URL,
  SERVICE_SLUG,
  getAllPrerenderRoutes,
  getCountryEntries,
} from "./seo-routes.mjs";
import { buildPrerenderHeader, buildPrerenderFooter } from "./prerender-layout.mjs";
import { buildRichContent } from "./prerender-content.mjs";

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
      "유튜브 프리미엄(YouTube Premium) 국가별·나라별 구독료를 한눈에 비교. 최저가 국가 순위와 한국 대비 절약률. 현재 환율 기준 최신 데이터.",
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
      description: "유튜브 프리미엄 가격 비교 서비스의 데이터 출처와 갱신 주기를 안내합니다.",
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

  if (route === "/" || route === `/${SERVICE_SLUG}`) {
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
      title: "유튜브 프리미엄 가격 변동 트렌드 · 국가별 구독료 변화 | OTT 가격 비교",
      description: "유튜브 프리미엄 국가별·나라별 최근 가격 하락 국가와 절약률 상위 국가를 확인하세요. 구독료 변동 추이.",
      heading: "유튜브 프리미엄 가격 변동 트렌드",
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "유튜브 프리미엄 가격 변동 트렌드",
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
  // / 또는 /youtube-premium → /og/v2/youtube-premium.png
  if (route === "/" || route === `/${SERVICE_SLUG}`) {
    return `${SITE_URL}/og/v2/${SERVICE_SLUG}.png`;
  }
  // 그 외 (about, privacy, community 등) — 기본 OG 이미지
  return `${SITE_URL}/og-image.png`;
}

function buildRouteHtml(templateHtml, route, countryMap) {
  const meta = routeToMeta(route, countryMap);
  const ogImage = routeToOgImage(route);

  let html = templateHtml;
  const canonicalUrl = route === "/" ? SITE_URL : `${SITE_URL}${route}`;
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

  // 리치 콘텐츠 우선 시도 → 없으면 기본 fallback
  const rich = buildRichContent(route);
  const mainContent = rich || `<div data-seo-prerender>${buildFallbackHtml(meta)}</div>`;
  const headerHtml = buildPrerenderHeader();
  const footerHtml = buildPrerenderFooter();

  const injection = `${headerHtml}${mainContent}${footerHtml}`;

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

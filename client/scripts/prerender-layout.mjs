// OttWatcher 프리렌더 공통 레이아웃: header + nav + footer
// 모든 프리렌더 페이지에 정적 HTML로 주입되어 크롤러의 사이트 항해와 콘텐츠 신호를 보장

import { readFileSync } from "node:fs";

import { PRIMARY_NAV_ITEMS } from "./primary-nav-items.mjs";
import { getCountryEntries } from "./seo-routes.mjs";

// 공유 카탈로그 단일 출처 — Vue 푸터와 같은 목록을 정적 HTML에도 심는다(JS 없이도 크롤 경로 확보)
const SERVICE_CATALOG = JSON.parse(
  readFileSync(
    new URL("../node_modules/@shakilabs/ui/dist/services.json", import.meta.url),
    "utf8",
  ),
);
const CURRENT_APP = "ott";

function buildOtherServicesBlock() {
  const rows = SERVICE_CATALOG.categories
    .map((category) => {
      const items = SERVICE_CATALOG.services.filter(
        (service) => service.categoryId === category.id && service.app !== CURRENT_APP,
      );
      if (!items.length) return "";
      const links = items
        .map(
          (service) =>
            `<a href="${service.href}" style="color:#64748b;text-decoration:none;margin-right:12px;">${service.shortLabel}</a>`,
        )
        .join("");
      return `<p style="margin:0 0 4px;"><span style="display:inline-block;min-width:78px;color:#94a3b8;">${category.label}</span>${links}</p>`;
    })
    .filter(Boolean)
    .join("");
  return `<nav aria-label="다른 서비스" style="margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #e2e8f0;font-size:13px;line-height:2;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#334155;">다른 서비스</p>
        ${rows}
      </nav>`;
}

const CURRENT_SERVICE = SERVICE_CATALOG.services.find((service) => service.app === CURRENT_APP);

// 헤더 사이트 링크 — Vue 헤더(AppHeader.vue의 links)와 같은 두 개. 모바일에서는 ☰ 안으로 들어간다.
const SITE_LINKS = [
  { href: "/blog", label: "블로그" },
  { href: "/ott/about", label: "소개" },
];

// 테마 토글의 정적 쌍둥이 — 패키지 ShThemeToggle과 같은 클래스·같은 아이콘. 수화 전이라 동작하지 않지만
// 자리가 비어 있으면 수화 때 데스크톱 사이트 링크가 옆으로 밀린다.
const STATIC_THEME_TOGGLE = `<div class="sh-global-header__utility"><button type="button" class="sh-theme-toggle" aria-label="다크 모드로 전환" style="width:44px;min-height:44px;border:0;background:transparent;color:#fafafa;"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" width="20" height="20"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.6" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg></button></div>`;

/**
 * 전체 메뉴(☰)의 정적 쌍둥이 — 0.3.38 "순수 내비게이션" 구조와 같다(04.card와 같은 마크업).
 *
 * 왜 필요한가: 프리렌더 산출물에는 Vue 출력이 없어 크롤러와 첫 페인트가 보는 셸은 전부 이 파일이 만든다.
 * 메뉴를 Vue에만 두면 모바일에서 탭 줄이 숨은 상태로 원시 HTML의 헤더 경로가 사라진다.
 * 패널은 패키지 CSS가 visibility:hidden·translateX(100%)로 숨기므로 화면에는 보이지 않고 DOM에만 남는다.
 */
function buildPrerenderDrawer() {
  const links = PRIMARY_NAV_ITEMS.map(
    ({ to, label }) => `<a class="sh-nav-drawer__link" href="/ott${to}">${label}</a>`,
  ).join("");
  const siteLinks = SITE_LINKS.map(
    ({ href, label }) => `<a class="sh-nav-drawer__site-link" href="${href}">${label}</a>`,
  ).join("");

  return `<button type="button" class="sh-nav-drawer__trigger" aria-label="메뉴 열기" aria-expanded="false" aria-controls="sh-nav-drawer-prerender" style="border:0;background:transparent;color:#fafafa;">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" width="22" height="22"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>
        </button>
        <div class="sh-nav-drawer" data-open="false">
          <div class="sh-nav-drawer__scrim"></div>
          <nav id="sh-nav-drawer-prerender" class="sh-nav-drawer__panel" aria-label="전체 메뉴" aria-hidden="true" tabindex="-1">
            <div class="sh-nav-drawer__head"><p class="sh-nav-drawer__heading"><span class="sh-nav-drawer__eyebrow">ShakiLabs</span>${CURRENT_SERVICE.shortLabel}</p></div>
            <div class="sh-nav-drawer__list">${links}</div>
            <div class="sh-nav-drawer__site">${siteLinks}</div>
          </nav>
        </div>`;
}

/**
 * 공통 헤더 — 수화 후 Vue 출력(검정 ShGlobalHeader + 조용한 탭 줄)과 같은 모양.
 *
 * 0.3.13에 묶여 있던 동안 이 블록은 "OTT Watcher · 구독료 비교" 흰 헤더였고, 수화하면 앱 자체 헤더로
 * 바뀌어 첫 페인트와 화면이 달랐다. header/nav는 body 직계 블록 둘로 나눈다 — removePrerenderFallback()이
 * body > [data-seo-prerender]를 지우고, prerender.mjs는 재실행 때 `<header data-seo-prerender`·
 * `<nav data-seo-prerender` 형태로 옛 블록을 찾으므로 data-seo-prerender는 태그 바로 뒤 첫 속성이어야 한다.
 * 사이트 링크 묶음(nav)에는 display를 인라인으로 주지 않는다 — 모바일 접힘 규칙(패키지 CSS)을 이기면 안 된다.
 */
export function buildPrerenderHeader() {
  const link = ({ href, label }) =>
    `<a class="sh-global-header__link" href="${href}" style="display:inline-flex;align-items:center;min-height:44px;padding-inline:10px;color:#a3a3a3;font-size:13px;font-weight:500;text-decoration:none;">${label}</a>`;
  const tabs = PRIMARY_NAV_ITEMS.map(
    ({ to, label }) =>
      `<a class="sh-primary-navigation__link" href="/ott${to}"><span class="sh-primary-navigation__label">${label}</span></a>`,
  ).join("");

  return `
    <header data-seo-prerender="header" class="sh-global-header sh-global-header--has-app" style="position:sticky;top:0;z-index:50;background:#0a0a0a;color:#fafafa;">
      <div class="sh-global-header__inner" style="display:flex;align-items:center;gap:16px;height:56px;margin-inline:auto;padding-inline:var(--sh-container-gutter, 16px);max-width:var(--sh-header-content-width, 72rem);">
        <div class="sh-global-header__start" style="display:flex;align-items:center;min-width:0;">
          <a class="sh-global-header__brand" href="/" aria-label="ShakiLabs 홈" style="display:inline-flex;align-items:center;min-height:44px;color:#fafafa;font-size:15px;font-weight:700;letter-spacing:-0.01em;text-decoration:none;white-space:nowrap;"><span class="sh-global-header__brand-text">ShakiLabs</span></a>
          <span class="sh-global-header__sep" aria-hidden="true" style="margin-inline:10px 4px;color:rgb(255 255 255 / 28%);font-size:16px;font-weight:400;">/</span>
          <a class="sh-global-header__app" href="${CURRENT_SERVICE.href}" style="display:inline-flex;align-items:center;min-height:44px;padding-inline:6px;color:#fafafa;font-size:15px;font-weight:600;text-decoration:none;white-space:nowrap;">${CURRENT_SERVICE.shortLabel}</a>
        </div>
        <div class="sh-global-header__end" style="display:flex;align-items:center;gap:16px;margin-inline-start:auto;">
          <nav class="sh-global-header__nav" aria-label="사이트 메뉴">${SITE_LINKS.map(link).join("")}</nav>
          ${STATIC_THEME_TOGGLE}
          ${buildPrerenderDrawer()}
        </div>
      </div>
    </header>
    <nav data-seo-prerender="nav" class="sh-primary-navigation" aria-label="주요 메뉴">
      <div class="sh-primary-navigation__container"><div class="sh-primary-navigation__list">${tabs}</div></div>
    </nav>`;
}

/**
 * 공통 푸터 (주요 국가 링크 + 서비스 안내 + 법적 고지)
 */
export function buildPrerenderFooter() {
  // 예전 목록은 손으로 적은 "저렴한 국가 TOP 10"이라 시드의 실제 순위(1위 나이지리아)와 달랐고,
  // 제목도 해외 요금 가입을 권하는 말투로 읽혔다. 시드에서 요금 낮은 순 10개국을 계산하고 중립 제목을 쓴다.
  const TOP_COUNTRIES = getCountryEntries()
    .filter((entry) => entry.krw != null)
    .sort((a, b) => a.krw - b.krw)
    .slice(0, 10)
    .map((entry) => ({ code: entry.countryCode, name: entry.country }));
  const MAJOR_COUNTRIES = [
    { code: "kr", name: "한국" },
    { code: "us", name: "미국" },
    { code: "gb", name: "영국" },
    { code: "jp", name: "일본" },
    { code: "au", name: "호주" },
    { code: "ca", name: "캐나다" },
    { code: "de", name: "독일" },
    { code: "fr", name: "프랑스" },
    { code: "sg", name: "싱가포르" },
    { code: "hk", name: "홍콩" },
  ];

  const cheapLinks = TOP_COUNTRIES.map(
    (c) =>
      `<li style="margin-bottom:4px;"><a href="/ott/youtube-premium/${c.code}" style="color:#64748b;text-decoration:none;font-size:13px;">${c.name} 가격</a></li>`
  ).join("");
  const majorLinks = MAJOR_COUNTRIES.map(
    (c) =>
      `<li style="margin-bottom:4px;"><a href="/ott/youtube-premium/${c.code}" style="color:#64748b;text-decoration:none;font-size:13px;">${c.name} 가격</a></li>`
  ).join("");

  return `
    <footer data-seo-prerender="footer" style="max-width:1120px;margin:40px auto 0;padding:24px 16px;border-top:1px solid #e2e8f0;background:#f8fafc;">
      <nav aria-label="국가별 페이지" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;margin-bottom:20px;">
        <div>
          <h3 style="font-size:13px;font-weight:700;color:#334155;margin:0 0 8px;">국가별 요금 순위</h3>
          <ul style="list-style:none;padding:0;margin:0;">${cheapLinks}</ul>
        </div>
        <div>
          <h3 style="font-size:13px;font-weight:700;color:#334155;margin:0 0 8px;">주요 국가</h3>
          <ul style="list-style:none;padding:0;margin:0;">${majorLinks}</ul>
        </div>
        <div>
          <h3 style="font-size:13px;font-weight:700;color:#334155;margin:0 0 8px;">서비스</h3>
          <ul style="list-style:none;padding:0;margin:0;">
            <li style="margin-bottom:4px;"><a href="/ott/youtube-premium" style="color:#64748b;text-decoration:none;font-size:13px;">전체 국가 비교</a></li>
            <li style="margin-bottom:4px;"><a href="/ott/youtube-premium/trends" style="color:#64748b;text-decoration:none;font-size:13px;">가격 트렌드</a></li>
            <li style="margin-bottom:4px;"><a href="/ott/about" style="color:#64748b;text-decoration:none;font-size:13px;">서비스 소개</a></li>
          </ul>
        </div>
      </nav>
      ${buildOtherServicesBlock()}
      <div style="padding-top:16px;border-top:1px solid #e2e8f0;font-size:13px;color:#64748b;line-height:1.8;">
        <p style="margin:0 0 6px;">운영 <strong>Shakilabs</strong> · 문의 <a href="mailto:skdba1313@gmail.com" style="color:#64748b;">skdba1313@gmail.com</a></p>
        <p style="margin:0 0 6px;">
          <a href="/blog" style="color:#64748b;margin-right:12px;">블로그</a>
          <a href="/ott/about" style="color:#64748b;margin-right:12px;">서비스 소개</a>
          <a href="/ott/privacy" style="color:#64748b;margin-right:12px;">개인정보처리방침</a>
          <a href="/ott/terms" style="color:#64748b;">이용약관</a>
        </p>
        <p style="margin:0 0 6px;">
          본 서비스는 공식 제휴 서비스가 아니며, 유튜브(Google LLC)의 공식 가격 정책과 다를 수 있습니다.
          가격 데이터는 공개된 정보를 확인해 제공하며, 원화 환산에는 환율 기준일 시점의 환율을 사용합니다.
        </p>
        <p style="margin:0;color:#334155;font-weight:600;">
          ⚠️ 다른 나라 요금은 그 나라에 실제로 거주하고 현지 결제 수단을 쓸 때만 적용됩니다. VPN·해외 주소로 가입하는 국가 변경 우회 구독은 YouTube 이용약관 위반이 될 수 있습니다.
        </p>
      </div>
    </footer>`;
}

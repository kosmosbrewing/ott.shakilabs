/**
 * 디자인 셸 게이트(v8) — 함대 기준 셸에서 벗어난 화면을 "계산된 스타일"로 잡는다.
 *
 * 왜 필요한가: 이 앱은 루트 15px·960px 컨테이너·푸른 회색 바탕으로 다른 11개 앱과 셸이 달랐고,
 * 메인 문서의 H1은 1×1 sr-only로 숨어 있었으며 국가 카드 캡션은 9px였다(2026-10-03 v8 점검).
 * 클래스 이름을 grep하는 검사로는 못 잡는다 — 같은 클래스라도 루트 크기·캐스케이드·미디어 규칙이
 * 실제 픽셀을 정한다(0.3.12 알약 사고). 그래서 빌드 산출물을 실제 브라우저로 띄워 잰다.
 *
 * 라우트마다 1280·390 두 폭에서 본다:
 *  1) 루트 글자 16px, 바탕 #F7F7F5(캔버스 토큰)
 *  2) H1이 정확히 하나, 화면에 보이고, 20px·700 이상·GmarketSans·대문자 변환 없음
 *  3) 본문 프레임이 패키지 sh-container이고 그 시작 x가 헤더 로고 x와 같다(1280에선 2차 탭 줄도)
 *  4) 본문(main) 안 보이는 글자 중 13px 미만이 없다
 *
 * 실행: npm run validate:design  (dist/가 빌드된 뒤)
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { getSitemapRoutes, getCountryRoutes } from "./seo-routes.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(process.env.DESIGN_DIST || path.resolve(__dirname, "../dist"));
const PORT = Number(process.env.DESIGN_PORT || 7398);
const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
];
const CANVAS = "rgb(247, 247, 245)";
const MIN_TEXT_PX = 13;
const H1_PX = 20;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

// 프로덕션과 같은 경로 규칙(/ott 접두어 제거 + <path>/index.html) — 접두어 없이 서빙하면 CSS가 404가 나
// "스타일 없는 문서"를 재게 된다(baby 오버플로 오진 전례).
function resolveFile(urlPath) {
  let p = decodeURIComponent(urlPath.split("?")[0]);
  if (p.startsWith("/ott")) p = p.slice(4) || "/";
  for (const candidate of [path.join(DIST_DIR, p), path.join(DIST_DIR, p, "index.html")]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function startServer() {
  const server = http.createServer((req, res) => {
    const file = req.url.startsWith("/api/") ? null : resolveFile(req.url);
    if (!file) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

// 브라우저 안에서 실행 — 계산된 값만 돌려준다(판정은 바깥에서).
function probe() {
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 2 && r.height > 2 && cs.visibility !== "hidden" && cs.display !== "none" &&
      cs.opacity !== "0" && !(cs.clip && cs.clip !== "auto");
  };
  const brand = document.querySelector(".sh-global-header__brand");
  const frame = document.querySelector("main#main-content > .sh-container");
  const navLabel = document.querySelector(".sh-primary-navigation__label");
  const h1s = [...document.querySelectorAll("h1")].map((el) => {
    const cs = getComputedStyle(el);
    return {
      text: el.textContent.trim().slice(0, 40),
      visible: visible(el),
      fontSize: parseFloat(cs.fontSize),
      fontWeight: Number(cs.fontWeight),
      family: cs.fontFamily.split(",")[0].replace(/["']/g, "").trim(),
      transform: cs.textTransform,
    };
  });
  const small = [];
  for (const el of document.querySelectorAll("main *")) {
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own || !visible(el)) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size < 13) small.push(`${size}px <${el.tagName.toLowerCase()}> "${el.textContent.trim().slice(0, 24)}"`);
  }
  const fcs = frame && getComputedStyle(frame);
  return {
    rootSize: getComputedStyle(document.documentElement).fontSize,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    h1s,
    brandX: brand ? brand.getBoundingClientRect().left : null,
    frameX: frame ? frame.getBoundingClientRect().left + parseFloat(fcs.paddingLeft) : null,
    navX: navLabel && visible(navLabel) ? navLabel.getBoundingClientRect().left : null,
    small: [...new Set(small)].slice(0, 6),
  };
}

const failures = [];
const rows = [];
const server = await startServer();
const browser = await chromium.launch();
// 국가 변형은 표본 3개(전 44개는 같은 뷰라 느리기만 하다)
const routes = [...getSitemapRoutes(), ...getCountryRoutes().slice(0, 3)];

try {
  for (const viewport of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport, colorScheme: "light" });
    for (const route of routes) {
      const page = await ctx.newPage();
      await page.goto(`http://localhost:${PORT}/ott${route === "/" ? "" : route}`, { waitUntil: "load" });
      await page.waitForFunction("document.querySelector('#app')?.children.length > 0", { timeout: 15000 });
      await page.waitForTimeout(600);
      const m = await page.evaluate(probe);
      await page.close();

      const where = `${route} @${viewport.width}`;
      const fail = (msg) => failures.push(`${where}: ${msg}`);
      if (m.rootSize !== "16px") fail(`루트 글자 ${m.rootSize} (기준 16px)`);
      if (m.bodyBg !== CANVAS) fail(`바탕 ${m.bodyBg} (캔버스 ${CANVAS})`);
      if (m.h1s.length !== 1) fail(`H1 ${m.h1s.length}개 (정확히 1개여야 한다)`);
      for (const h of m.h1s) {
        if (!h.visible) fail(`H1 "${h.text}"이 화면에 보이지 않는다(sr-only·1×1)`);
        if (h.fontSize !== H1_PX) fail(`H1 "${h.text}" ${h.fontSize}px (기준 ${H1_PX}px)`);
        if (h.fontWeight < 700) fail(`H1 "${h.text}" 굵기 ${h.fontWeight} (기준 700)`);
        if (h.family !== "GmarketSans") fail(`H1 "${h.text}" 서체 ${h.family} (기준 GmarketSans)`);
        if (h.transform !== "none") fail(`H1 "${h.text}" text-transform ${h.transform}`);
      }
      if (m.frameX == null) fail("본문 프레임(main > .sh-container)이 없다");
      else if (m.brandX == null || Math.abs(m.frameX - m.brandX) > 1)
        fail(`본문 시작 x ${m.frameX} ≠ 헤더 로고 x ${m.brandX}`);
      if (m.navX != null && m.brandX != null && Math.abs(m.navX - m.brandX) > 1)
        fail(`2차 탭 줄 시작 x ${m.navX} ≠ 헤더 로고 x ${m.brandX}`);
      for (const s of m.small) fail(`${MIN_TEXT_PX}px 미만 글자 ${s}`);

      rows.push(
        `${where.padEnd(32)} root=${m.rootSize} h1=${m.h1s.map((h) => `${h.fontSize}px/${h.fontWeight}`).join(",")}` +
          ` frameX=${m.frameX} brandX=${m.brandX} small=${m.small.length}`
      );
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}

process.stdout.write(`\n[validate-design-shell]\n${rows.join("\n")}\n\n`);
if (failures.length > 0) {
  process.stderr.write(`[validate-design-shell] ${failures.length} problem(s):\n`);
  for (const f of failures) process.stderr.write(`  - ${f}\n`);
  process.exit(1);
}
process.stdout.write(`[validate-design-shell] ok — ${routes.length} routes × ${VIEWPORTS.length} widths\n`);

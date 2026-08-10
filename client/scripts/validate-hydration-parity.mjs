/**
 * 하이드레이션 패리티 게이트 — "JS 끔에는 보이는데 JS 켬에는 사라지는 본문"을 잡는다.
 *
 * 왜 필요한가: 앱이 마운트되면 removePrerenderFallback()이 body의 프리렌더 블록을
 * 지운다. 그래서 프리렌더에만 문구를 넣으면 정적 HTML에는 있고 화면에는 없는 상태가
 * 되는데, 이는 사람 심사자와 렌더링 크롤러가 못 보는 콘텐츠이자 은닉 텍스트 리스크다.
 * 실제로 이 앱은 이 상태로 배포돼 홈 본문 비율이 15%까지 떨어졌었다.
 *
 * 선언만 검사해서는 못 잡는 종류의 버그라(스크립트도 뷰도 각자는 멀쩡해 보인다)
 * 실제 브라우저에서 두 번 렌더해 비교한다.
 *
 * 두 가지를 본다:
 *  1) 섹션 존재 — seo-content.mjs가 live:false로 표시한 섹션의 소제목이
 *     하이드레이션 후 DOM에 남아 있는가. API 상태와 무관하게 결정적이다.
 *  2) 자수 비율 — live 섹션이 없는 라우트(문서형)는 JS 끔/켬 본문 자수가
 *     MIN_RATIO 이상인가. live 섹션이 있는 라우트는 뷰가 API 데이터로 대체 렌더하므로
 *     정적 스냅샷과 자수가 다를 수 있어 비율 검사 대상에서 뺀다.
 *
 * 실행: npm run validate:parity  (dist/가 빌드된 뒤)
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { getSitemapRoutes, getCountryRoutes } from "./seo-routes.mjs";
import { configureSeoContent, buildSections } from "./seo-content.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, "../dist");
const PORT = Number(process.env.PARITY_PORT || 7399);
const MIN_RATIO = 0.9;

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, relativePath), "utf-8"));
}

configureSeoContent({
  priceSeed: readJson("../../data/prices/youtube-premium.json"),
  history: readJson("../../data/history/youtube-premium.json"),
  changelog: readJson("../../data/reports/changelog.json"),
  services: readJson("../../data/services.json"),
});

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

// 프로덕션과 같은 경로 규칙(/ott 접두어 제거 + <path>/index.html)으로 dist를 서빙한다.
function resolveFile(urlPath) {
  let p = decodeURIComponent(urlPath.split("?")[0]);
  if (p.startsWith("/ott")) p = p.slice(4) || "/";
  if (!p.startsWith("/")) p = `/${p}`;
  for (const candidate of [
    path.join(DIST_DIR, p),
    path.join(DIST_DIR, p, "index.html"),
    path.join(DIST_DIR, `${p}.html`),
  ]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function startServer() {
  const server = http.createServer((req, res) => {
    // API는 일부러 막는다 — 이 게이트가 네트워크 상태에 흔들리지 않아야 하고,
    // 공유 콘텐츠는 커밋된 시드에서 나오므로 API 없이도 반드시 렌더돼야 한다.
    if (req.url.startsWith("/api/")) {
      res.writeHead(503, { "content-type": "application/json" });
      res.end("{}");
      return;
    }
    const file = resolveFile(req.url);
    if (!file) {
      res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
      res.end("not found");
      return;
    }
    res.writeHead(200, {
      "content-type": MIME[path.extname(file)] || "application/octet-stream",
    });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

const normalize = (value) => String(value).replace(/\s+/g, " ").trim();
const stripTags = (html) => normalize(String(html).replace(/<[^>]+>/g, " "));

/**
 * 섹션이 화면에 살아 있는지 볼 탐침 문자열.
 * 소제목은 짧고 고유해서 innerText 정규화 차이에 견딘다.
 * 소제목이 없는 섹션은 본문 앞부분을 쓴다.
 */
function probesFor(section) {
  const headings = [...section.html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
    .map((match) => stripTags(match[1]))
    .filter((text) => text.length >= 4);
  if (headings.length > 0) return headings;
  const text = stripTags(section.html);
  return text.length >= 12 ? [text.slice(0, 40)] : [];
}

const failures = [];
const rows = [];

const server = await startServer();
const browser = await chromium.launch();

// 사이트맵 라우트 전부 + 국가 변종 표본(전 44개를 다 띄우면 느리다)
const countryRoutes = getCountryRoutes();
const routes = [...getSitemapRoutes(), ...countryRoutes.slice(0, 3)];

try {
  for (const route of routes) {
    const url = `http://localhost:${PORT}/ott${route === "/" ? "" : route}`;
    const sections = buildSections(route);
    const viewSections = sections.filter((section) => !section.live);
    const hasLiveSections = sections.some((section) => section.live);

    const offCtx = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 1440, height: 900 },
    });
    const offPage = await offCtx.newPage();
    await offPage.goto(url, { waitUntil: "load" });
    const offChars = (await offPage.evaluate("document.body.innerText")).replace(/\s+/g, " ").trim()
      .length;
    await offCtx.close();

    const onCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const onPage = await onCtx.newPage();
    await onPage.goto(url, { waitUntil: "load" });
    // 라우터가 준비된 뒤에 마운트하므로 프리렌더 제거까지 한 박자 기다린다
    await onPage.waitForFunction("document.querySelector('#app')?.children.length > 0", {
      timeout: 15000,
    });
    await onPage.waitForTimeout(600);
    const onText = normalize(await onPage.evaluate("document.body.innerText"));
    const onChars = onText.length;
    await onCtx.close();

    const ratio = offChars === 0 ? 0 : onChars / offChars;
    rows.push(
      `${route.padEnd(28)} off=${String(offChars).padStart(5)} on=${String(onChars).padStart(5)}` +
        ` ratio=${(ratio * 100).toFixed(1)}%${hasLiveSections ? " (ratio not enforced: has live sections)" : ""}`
    );

    // 1) 공유 섹션이 하이드레이션 후에도 화면에 있는가
    for (const section of viewSections) {
      for (const probe of probesFor(section)) {
        if (!onText.includes(probe)) {
          failures.push(
            `${route}: 프리렌더 섹션 "${section.id}"이 하이드레이션 후 사라졌다 — ` +
              `화면에서 "${probe}"를 찾을 수 없음. ` +
              `해당 라우트의 뷰가 <SeoRichContent route="${route}" />를 렌더하는지 확인하라.`
          );
          break;
        }
      }
    }

    // 2) 문서형 라우트는 자수 비율까지 본다
    if (!hasLiveSections && ratio < MIN_RATIO) {
      failures.push(
        `${route}: JS 끔/켬 본문 자수 비율 ${(ratio * 100).toFixed(1)}% < ${MIN_RATIO * 100}% ` +
          `(off=${offChars}, on=${onChars})`
      );
    }
  }
} finally {
  await browser.close();
  server.close();
}

process.stdout.write(`\n[validate-hydration-parity]\n${rows.join("\n")}\n\n`);

if (failures.length > 0) {
  process.stderr.write(`[validate-hydration-parity] ${failures.length} problem(s):\n`);
  for (const failure of failures) process.stderr.write(`  - ${failure}\n`);
  process.stderr.write("\n");
  process.exit(1);
}

process.stdout.write(
  `[validate-hydration-parity] ok — ${routes.length} routes, ` +
    `프리렌더 본문이 하이드레이션 후에도 전부 화면에 남아 있다\n`
);

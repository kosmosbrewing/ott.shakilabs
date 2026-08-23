/**
 * src/router/index.ts를 읽어 "이 앱이 실제로 서빙하는 URL 집합"을 만든다.
 *
 * 왜 라우터를 원본으로 삼는가: seo-routes.mjs는 라우터 표를 손으로 베낀 사본이고,
 * 이 게이트가 존재하는 이유인 결함은 언제나 사본이 원본에서 떨어져 나간 것이었다
 * (car는 어떤 사이트맵에도 없는 홈을 배포했다). 사본끼리 비교하면 둘 다 틀려도
 * 통과하므로, 판정은 라우터 소스에서 직접 파생해야 한다.
 *
 * 폴백은 의도적으로 없다. 라우터 모양이 바뀌어 파싱이 깨지면 조용히 빈 집합을
 * 검증하고 성공을 보고하는 대신 크게 실패해야 한다.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROUTER_PATH = path.resolve(__dirname, "../src/router/index.ts");
const SERVICES_PATH = path.resolve(__dirname, "../../data/services.json");

function fail(message) {
  throw new Error(`[router-routes] ${message}`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 라우터는 서비스 슬러그 세그먼트를 data/services.json에서 런타임에 만든다.
// "youtube-premium"을 하드코딩하지 않고 같은 시드에서 다시 계산하는 이유:
// 두 번째 서비스를 active로 켜면 라우터와 게이트가 동시에 움직여야 하고,
// 그래야 게이트가 "실제로 서빙되는 것"에 대해 계속 참을 말한다.
function activeServiceSlugPattern() {
  const seed = JSON.parse(fs.readFileSync(SERVICES_PATH, "utf-8"));
  const slugs = (seed.services ?? [])
    .filter((service) => service.active)
    .map((service) => String(service.slug).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return slugs.join("|") || "__no-active-service__";
}

// 알고 있는 보간만 치환한다. 모르는 ${...}를 빈 문자열로 만들면 파라미터 라우트가
// 그럴듯한 리터럴로 둔갑해 존재하지 않는 라우트 표를 검증하게 되므로 즉시 중단한다.
function resolveInterpolations(raw, bindings) {
  const resolved = raw.replace(/\$\{(\w+)\}/g, (_, name) => {
    if (!(name in bindings)) {
      fail(
        `src/router/index.ts: 라우트 경로가 알 수 없는 값 \${${name}}을 보간한다 - ` +
          "router-routes.mjs의 bindings에 파생 규칙을 추가하기 전에는 서빙 URL을 알 수 없다"
      );
    }
    return bindings[name];
  });
  if (resolved.includes("${")) {
    fail(`src/router/index.ts: 경로 "${raw}"의 보간을 끝까지 해석하지 못했다`);
  }
  return resolved;
}

/** [{ source, path, redirect }] — 선언 순서 그대로. */
export function parseRouterRoutes() {
  const source = fs.readFileSync(ROUTER_PATH, "utf-8");
  const start = source.search(/const routes\s*:/);
  if (start === -1) {
    fail(
      "src/router/index.ts에서 `const routes:` 선언을 찾지 못했다 - 라우트 표를 " +
        "추출할 수 없으므로 사이트맵을 라우터와 대조할 수 없다"
    );
  }
  // 배열 종료 지점에서 자른다. 그 뒤(가드·애널리틱스 훅)는 라우트 선언이 아니다.
  const end = source.indexOf("\n];", start);
  if (end === -1) fail("src/router/index.ts: 라우트 배열이 `\\n];`로 끝나지 않는다");
  const body = source.slice(start, end);

  const marks = [...body.matchAll(/path:\s*(["'`])((?:\\.|(?!\1).)*)\1/g)].map((match) => ({
    raw: match[2],
    index: match.index,
  }));
  if (marks.length === 0) fail("src/router/index.ts: 라우트 경로를 하나도 추출하지 못했다");

  const bindings = { serviceSlugRoute: activeServiceSlugPattern() };
  return marks.map((mark, index) => ({
    source: mark.raw,
    path: resolveInterpolations(mark.raw, bindings),
    // 한 라우트의 본문은 다음 `path:` 선언 직전까지다.
    redirect: /redirect:/.test(body.slice(mark.index, marks[index + 1]?.index ?? body.length)),
  }));
}

// 리터럴 슬러그의 단순 교대(alternation)로만 제한된 파라미터는 유한한 URL 집합으로
// 펼쳐지므로 사이트맵 관점에서는 정적 URL이다. 열린 제약([A-Za-z]{2}, .*)은 아니다.
const LITERAL_ALTERNATION = /^[A-Za-z0-9._~-]+(?:\|[A-Za-z0-9._~-]+)*$/;

function constraintOf(segment) {
  return segment.match(/^:\w+\(([^()]*)\)$/)?.[1] ?? null;
}

/** 유한하면 구체 URL 배열, 아니면 null. */
export function expandRoute(routePath) {
  let urls = [""];
  for (const segment of routePath.split("/").slice(1)) {
    let options;
    if (!segment.startsWith(":")) {
      options = [segment];
    } else {
      const constraint = constraintOf(segment);
      if (constraint === null || !LITERAL_ALTERNATION.test(constraint)) return null;
      options = constraint.split("|");
    }
    urls = urls.flatMap((prefix) => options.map((option) => `${prefix}/${option}`));
  }
  return urls.map((url) => url || "/");
}

// 캐치올(`(.*)`)은 NotFound를 렌더하므로 "서빙한다"로 세면 모든 URL이 서빙되는 것처럼
// 보여 검사가 아무것도 주장하지 못하게 된다. 매처에서 제외한다.
export function isCatchAll(routePath) {
  return routePath.includes("(.*)");
}

function segmentPattern(segment) {
  if (!segment.startsWith(":")) return escapeRegExp(segment);
  const constraint = constraintOf(segment);
  if (constraint !== null) return `(?:${constraint})`;
  if (/^:\w+$/.test(segment)) return "[^/]+";
  return fail(`src/router/index.ts: 해석할 수 없는 경로 세그먼트 "${segment}"`);
}

/** (url) => boolean — 리다이렉트·캐치올이 아닌 라우트가 이 URL을 렌더하는가. */
export function buildServeMatcher(routes) {
  const patterns = routes
    .filter((route) => !route.redirect && !isCatchAll(route.path))
    .map((route) => {
      const body = route.path
        .split("/")
        .slice(1)
        .map((segment) => `/${segmentPattern(segment)}`)
        .join("");
      return new RegExp(`^${body || "/"}$`);
    });
  return (url) => patterns.some((pattern) => pattern.test(url));
}

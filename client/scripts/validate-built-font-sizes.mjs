// 빌드 산출물 글자 크기 게이트(v8c, 2026-10-04 사용자 결정 ④ "12px도 13px로").
// 소스 유틸리티 스캔은 세 사각지대를 통과시켰다: 일반 CSS 클래스(.eyebrow 0.7rem), 프리렌더 인라인
// style="font-size:12px", 미디어·무조건 축소 규칙. 그래서 배포되는 CSS와 HTML을 직접 읽는다.
// - CSS: 13px 미만 px/rem font-size는 실패. 허용은 차트 축 눈금(`__scale`, 12px), 앱 차트 디렉터리 전용
//   `text-[12px]`(소스 게이트가 위치를 강제), 글리프(.retro-details-chevron)뿐. 0(공백 제거 핵)과 %/em은 제외.
// - HTML: 인라인 style의 13px 미만 font-size는 예외 없이 실패.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const FLOOR = 13;
const ALLOW = [
  { test: (sel) => /__scale(?![\w-])/.test(sel), floor: 12 },
  { test: (sel) => /\.text-\\\[12px\\\]/.test(sel), floor: 12 },
  { test: (sel) => /\.retro-details-chevron/.test(sel), floor: 11 },
];

function walk(dir, ext, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, ext, out);
    else if (name.endsWith(ext)) out.push(full);
  }
  return out;
}

function toPx(value, unit) {
  return unit === "rem" ? Number(value) * 16 : Number(value);
}

export function validateBuiltFontSizes({ distRoot }) {
  const violations = [];
  let checked = 0;
  for (const file of walk(distRoot, ".css")) {
    const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    // 가장 안쪽 블록 단위(미디어 쿼리 안 규칙 포함)
    for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = rule[1].trim();
      if (selector.startsWith("@font-face")) continue;
      for (const decl of rule[2].matchAll(/font-size:\s*([\d.]+)(px|rem)\b/g)) {
        checked += 1;
        const px = toPx(decl[1], decl[2]);
        if (px === 0 || px >= FLOOR) continue;
        const parts = selector.split(",").map((s) => s.trim());
        const allowed = parts.every((part) => ALLOW.some((rule) => rule.test(part) && px >= rule.floor));
        if (!allowed) violations.push(`${relative(distRoot, file)}: ${selector.slice(0, 90)} → ${decl[0]}`);
      }
    }
  }
  for (const file of walk(distRoot, ".html")) {
    const html = readFileSync(file, "utf8");
    for (const m of html.matchAll(/style="[^"]*font-size:\s*([\d.]+)(px|rem)\b[^"]*"/g)) {
      checked += 1;
      const px = toPx(m[1], m[2]);
      if (px > 0 && px < FLOOR) violations.push(`${relative(distRoot, file)}: inline ${m[0].slice(0, 80)}`);
    }
  }
  if (violations.length) {
    throw new Error(
      `Built output has text under ${FLOOR}px (only chart axis __scale / chart text-[12px] may be 12px):\n  ` +
        violations.slice(0, 25).join("\n  ") + (violations.length > 25 ? `\n  … +${violations.length - 25}` : "")
    );
  }
  return checked;
}

// 단독 실행: node validate-built-font-sizes.mjs <distRoot>
if (import.meta.url === `file://${process.argv[1]}`) {
  const distRoot = process.argv[2];
  if (!distRoot) { console.error("usage: node validate-built-font-sizes.mjs <distRoot>"); process.exit(2); }
  try {
    const n = validateBuiltFontSizes({ distRoot });
    console.log(`Validated built font sizes — ${n} declarations, 0 under 13px outside the chart-axis allowance.`);
  } catch (error) { console.error(error.message); process.exit(1); }
}

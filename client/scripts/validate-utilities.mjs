/**
 * 소스에 적은 색 유틸리티가 실제로 CSS 규칙이 됐는지 확인한다.
 *
 * 왜 필요한가: Tailwind의 슬래시 투명도는 opacity 스케일(5·10·20·25…)에 있는 값만
 * 클래스를 만든다. `bg-primary/12`처럼 스케일 밖 숫자를 적으면 빌드는 아무 경고 없이
 * 통과하고, 클래스는 CSS에 존재하지 않아 그 자리에 배경이 그냥 안 칠해진다. 테마에
 * 없는 색 이름(`bg-warning` — 이 앱의 토큰은 status.warning이다)도 같은 방식으로
 * 조용히 사라진다. 화면을 봐도 "원래 그런 디자인"으로 읽히기 때문에 눈으로는 못 잡는다.
 *
 * 함대 실측: travel 6종 8곳(전 페이지 헤더 배경이 페이지 배경과 같은 색이었다),
 * car 12종(보조금 경고 배너가 색·배경 둘 다 죽은 채 배포), ott는 RelatedServices의
 * 아이콘 칩이 `bg-primary/12`로 6개월간 안 칠해져 있었다.
 */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// 색 유틸리티 + 슬래시 투명도만 본다. 레이아웃 유틸까지 넓히면 런타임에 조립되는
// 클래스 문자열 때문에 오탐이 늘어 게이트를 신뢰할 수 없게 된다.
//
// variant 접두어는 반드시 토큰째로 함께 잡아야 한다. `[&_th]:bg-background/95`의
// 셀렉터는 `.\[\&_th\]\:bg-background\/95`이므로, 꼬리(`bg-background/95`)만 떼어
// 찾으면 멀쩡한 클래스를 "생성 안 됨"으로 오판한다(실제로 이 앱에서 3건 오탐했다).
const UTILITY_TOKEN =
  /^(?:(?:[a-z][a-z0-9-]*|\[[^\]\s]*\]):)*(?:bg|text|border|ring|divide|fill|stroke|outline|placeholder|from|via|to|shadow|accent|caret|decoration)-[a-z][a-z0-9-]*\/(?:\d+|\[[0-9.]+%?\])$/;

// Tailwind는 클래스명에서 식별자 문자가 아닌 것을 모두 백슬래시로 이스케이프한다.
const toSelector = (cls) => cls.replace(/[^A-Za-z0-9_-]/g, (ch) => `\\${ch}`);

function collectSourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) collectSourceFiles(full, out);
    else if (/\.(vue|ts)$/.test(entry.name) && !/\.test\.ts$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** 생성되지 않은 유틸리티 목록. 빈 배열이면 통과. */
export function findUngeneratedUtilities({ srcDir, cssDir }) {
  const cssFiles = readdirSync(cssDir).filter((name) => name.endsWith(".css"));
  if (cssFiles.length === 0) {
    throw new Error("[validate-utilities] 빌드된 CSS가 없어 유틸리티 생성 여부를 검사할 수 없다");
  }
  const css = cssFiles.map((name) => readFileSync(resolve(cssDir, name), "utf8")).join("\n");

  const missing = [];
  for (const file of collectSourceFiles(srcDir)) {
    const source = readFileSync(file, "utf8");
    // 클래스 토큰 경계로 자른 뒤 통째로 판정한다(위 UTILITY_TOKEN 주석 참고).
    for (const cls of new Set(source.split(/[\s"'`{}()=<>,;]+/))) {
      if (!UTILITY_TOKEN.test(cls)) continue;
      if (css.includes(`.${toSelector(cls)}`)) continue;
      missing.push({ cls, file: file.slice(srcDir.length + 1) });
    }
  }
  return missing;
}

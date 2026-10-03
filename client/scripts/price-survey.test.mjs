/**
 * 요금 조사 출처 게이트 — "출처 없는 값"과 "재확인하지 않은 값에 붙은 재확인 날짜"를 막는다.
 *
 * data/prices/youtube-premium.json의 각 국가 행은 survey 블록을 갖는다.
 *  - surveyedAt: 전수 조사일(= lastUpdated). 재확인하지 못한 칸의 값은 이 날짜의 값이다.
 *  - recheckedAt + verified: { 플랜: [공식 출처 URL] } — 공식 출처로 다시 확인한 칸에만 있다.
 *  - unverified: [플랜] — 전수 조사 값을 그대로 둔 칸.
 *  - previous: { 플랜: 옛 값 } — 재확인 결과 값이 달라 갱신한 칸.
 *
 * 화면의 요금 조사 문장("N개국 재확인 … 나머지 M개국")과 표의 행별 표시는 이 블록에서 계산된다.
 * 여기서는 그 숫자를 survey 블록에서 **따로 다시 세어** 대조하고(같은 함수로 비교하면 항등식이다),
 * 시드를 바꿨을 때 문장이 따라 움직이는지까지 본다(손으로 쓴 숫자면 움직이지 않는다).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import * as D from "./seo-discoveries.mjs";
import { configureSeoContent, buildRichContent, buildSections } from "./seo-content.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readJson = (rel) => JSON.parse(fs.readFileSync(path.resolve(__dirname, rel), "utf-8"));

const SEED = readJson("../../data/prices/youtube-premium.json");
const CONTEXT = {
  history: readJson("../../data/history/youtube-premium.json"),
  changelog: readJson("../../data/reports/changelog.json"),
  services: readJson("../../data/services.json"),
};
const configure = (seed) => configureSeoContent({ priceSeed: seed, ...CONTEXT });
configure(SEED);
afterAll(() => configure(SEED));

// 공식 출처로 인정하는 호스트 — 유튜브·구글 소유 도메인만. 제3자 비교 사이트·언론은 출처가 아니다.
const OFFICIAL_HOSTS = new Set([
  "www.youtube.com",
  "youtube.com",
  "music.youtube.com",
  "blog.youtube",
  "blog.google",
  "support.google.com",
  "one.google.com",
  "store.google.com",
  "gemini.google",
]);

const STATUS_LABEL = { verified: "확인", partial: "부분 확인", unverified: "미확인" };
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const stripTags = (html) =>
  String(html).replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
const textOf = (route) => stripTags(buildRichContent(route));

/** 테스트 쪽 독립 집계 — seo-discoveries.surveyRounds를 쓰지 않고 survey 블록을 직접 센다. */
function countIndependently(seed) {
  let rechecked = 0;
  let partial = 0;
  let cells = 0;
  const updated = [];
  for (const row of seed.prices) {
    const verified = Object.keys(row.survey.verified ?? {});
    if (verified.length > 0) {
      rechecked += 1;
      cells += verified.length;
      if ((row.survey.unverified ?? []).length > 0) partial += 1;
    }
    const changed = Object.keys(row.survey.previous ?? {}).length;
    if (changed > 0) updated.push({ country: row.country, cells: changed });
  }
  return { rechecked, partial, cells, retained: seed.prices.length - rechecked, updated };
}

const SENTENCE =
  /(\d{4}-\d{2}-\d{2}) 전수 조사 · (\d{4}-\d{2}-\d{2}) 공식 출처로 (\d+)개국 재확인\(([^)]*)\), 나머지 (\d+)개국은 (\d{2}-\d{2}) 값/;

function parseSentence(text) {
  const m = text.match(SENTENCE);
  expect(m, "요금 조사 문장이 본문에 있어야 한다").not.toBeNull();
  const [, full, recheck, rechecked, details, retained, retainedDate] = m;
  const updated = [...details.matchAll(/([^\s,·(]+) (\d+)개/g)]
    .filter((u) => !/국은/.test(u[0]))
    .map((u) => ({ country: u[1], cells: Number(u[2]) }));
  const partial = details.match(/(\d+)개국은 일부 요금제만/);
  return {
    full,
    recheck,
    rechecked: Number(rechecked),
    retained: Number(retained),
    retainedDate,
    updated: details.includes("값 변동 없음") ? [] : updated,
    partial: partial ? Number(partial[1]) : 0,
  };
}

const recheckDateOf = (seed) =>
  [...new Set(seed.prices.map((r) => r.survey.recheckedAt).filter(Boolean))];

describe("요금 조사 출처 (survey 블록)", () => {
  it("모든 행의 전수 조사일은 lastUpdated 하나다", () => {
    for (const row of SEED.prices) {
      expect(row.survey, `${row.countryCode}: survey 없음`).toBeDefined();
      expect(row.survey.surveyedAt, row.countryCode).toBe(SEED.lastUpdated);
      expect(Object.keys(STATUS_LABEL)).toContain(row.survey.status);
      expect(row.survey.label, row.countryCode).toBe(STATUS_LABEL[row.survey.status]);
    }
  });

  it("재확인 날짜는 재확인한 칸이 있는 행에만 있고, 회차는 하나이며 전수 조사 뒤다", () => {
    for (const row of SEED.prices) {
      const verified = Object.keys(row.survey.verified ?? {});
      expect(Boolean(row.survey.recheckedAt), row.countryCode).toBe(verified.length > 0);
    }
    const dates = recheckDateOf(SEED);
    expect(dates).toHaveLength(1);
    expect(dates[0]).toMatch(ISO_DATE);
    expect(dates[0] > SEED.lastUpdated).toBe(true);
  });

  it("확인 칸과 미확인 칸이 요금제 칸을 빠짐없이, 겹치지 않게 나눈다", () => {
    for (const row of SEED.prices) {
      const plans = Object.keys(row.plans).sort();
      const verified = Object.keys(row.survey.verified ?? {});
      const unverified = row.survey.unverified ?? [];
      expect([...verified, ...unverified].sort(), row.countryCode).toEqual(plans);
      expect(verified.filter((p) => unverified.includes(p)), row.countryCode).toEqual([]);
      const expected =
        unverified.length === 0 ? "verified" : verified.length === 0 ? "unverified" : "partial";
      expect(row.survey.status, row.countryCode).toBe(expected);
    }
  });

  it("확인 칸은 전부 공식 도메인 출처 URL을 하나 이상 갖는다", () => {
    for (const row of SEED.prices) {
      for (const [plan, urls] of Object.entries(row.survey.verified ?? {})) {
        expect(Array.isArray(urls) && urls.length > 0, `${row.countryCode}.${plan}`).toBe(true);
        for (const url of urls) {
          const parsed = new URL(url);
          expect(parsed.protocol, url).toBe("https:");
          expect(OFFICIAL_HOSTS.has(parsed.hostname), `${row.countryCode}.${plan}: ${url}`).toBe(true);
        }
      }
    }
  });

  it("갱신 기록(previous)은 재확인한 칸에만 있고 지금 값과 다르다", () => {
    for (const row of SEED.prices) {
      for (const [plan, old] of Object.entries(row.survey.previous ?? {})) {
        expect(Object.keys(row.survey.verified ?? {}), `${row.countryCode}.${plan}`).toContain(plan);
        expect(row.plans[plan].monthly, `${row.countryCode}.${plan}`).not.toBe(old);
      }
    }
  });

  it("값이 바뀐 칸의 환산값은 저장소 환율 규칙(fetch-exchange-rates.ts)과 일치한다", () => {
    // 규칙: usd = round(현지가 / 환율, 2) (USD는 그대로), krw = round(usd × krwRate)
    const rates = readJson("../../data/exchange-rates.json").rates;
    for (const row of SEED.prices) {
      const rate =
        row.currency === "USD" ? 1 : row.currency === "KRW" ? SEED.krwRate : rates[row.currency];
      if (!rate) continue; // 환율표에 없는 통화(GEL·BOB·DZD·MAD)는 재확인 칸이 없다
      for (const plan of Object.keys(row.survey.verified ?? {})) {
        const usd = Math.round((row.plans[plan].monthly / rate) * 100) / 100;
        expect(row.converted[plan].usd, `${row.countryCode}.${plan}`).toBe(usd);
        expect(row.converted[plan].krw, `${row.countryCode}.${plan}`).toBe(Math.round(usd * SEED.krwRate));
      }
    }
  });
});

describe("요금 조사 문장 — 숫자는 데이터와 같아야 한다", () => {
  it("가격표 페이지 문장의 날짜·국가 수·갱신 수가 survey 블록을 따로 센 값과 같다", () => {
    const parsed = parseSentence(textOf("/youtube-premium"));
    const expected = countIndependently(SEED);
    expect(parsed.full).toBe(SEED.lastUpdated);
    expect(parsed.recheck).toBe(recheckDateOf(SEED)[0]);
    expect(parsed.rechecked).toBe(expected.rechecked);
    expect(parsed.retained).toBe(expected.retained);
    expect(parsed.rechecked + parsed.retained).toBe(SEED.prices.length);
    expect(parsed.partial).toBe(expected.partial);
    expect(parsed.updated).toEqual(expected.updated);
    expect(parsed.retainedDate).toBe(SEED.lastUpdated.slice(5));
  });

  it("문장은 요금 날짜를 싣는 모든 도구 페이지에 같은 모양으로 실린다", () => {
    const sentence = D.surveyProvenanceSentence(SEED);
    for (const route of ["/", "/youtube-premium", "/youtube-premium/trends", "/about"]) {
      expect(textOf(route), route).toContain(sentence);
    }
  });

  it("역방향: 시드를 바꾸면 문장이 따라 움직인다(손으로 쓴 숫자가 아니다)", () => {
    const base = parseSentence(D.surveyProvenanceSentence(SEED));
    const mutated = structuredClone(SEED);
    // 미확인 국가 하나를 개인 요금만 재확인한 것으로 바꾼다
    const target = mutated.prices.find((r) => r.survey.status === "unverified" && r.plans.family);
    target.survey = {
      ...target.survey,
      status: "partial",
      label: "부분 확인",
      recheckedAt: recheckDateOf(SEED)[0],
      verified: { individual: ["https://store.google.com/"] },
      unverified: Object.keys(target.plans).filter((p) => p !== "individual"),
    };
    // 갱신 기록도 하나 지운다
    const updatedRow = mutated.prices.find((r) => r.survey.previous);
    const removed = Object.keys(updatedRow.survey.previous)[0];
    delete updatedRow.survey.previous[removed];

    const after = parseSentence(D.surveyProvenanceSentence(mutated));
    expect(after.rechecked).toBe(base.rechecked + 1);
    expect(after.retained).toBe(base.retained - 1);
    expect(after.partial).toBe(base.partial + 1);
    expect(after.updated[0].cells).toBe(base.updated[0].cells - 1);

    // 렌더된 페이지도 같이 움직이는지 — 프리렌더와 뷰가 같은 함수를 쓰므로 여기서 확인된다
    configure(mutated);
    try {
      const page = parseSentence(textOf("/youtube-premium"));
      expect(page.rechecked).toBe(after.rechecked);
      expect(page.retained).toBe(after.retained);
    } finally {
      configure(SEED);
    }
  });

  it("'사람이 확인한' 범위는 재확인한 칸으로 한정된다", () => {
    const expected = countIndependently(SEED);
    const scope = new RegExp(
      `사람이 다시 확인한 것은 ${recheckDateOf(SEED)[0]}의 (\\d+)개국 (\\d+)개 값뿐입니다`
    );
    for (const route of ["/", "/youtube-premium", "/about"]) {
      const text = textOf(route);
      // 옛 문장: 전수 조사 날짜를 "각국 정가를 사람이 확인한 날"이라고 불렀다
      expect(text, route).not.toContain("각국 현지 통화 정가를 사람이 확인한 날");
      expect(text, route).not.toMatch(/모든 가격은[^.]*직접 대조해 검증/);
    }
    for (const route of ["/", "/about"]) {
      const m = textOf(route).match(scope);
      expect(m, route).not.toBeNull();
      expect(Number(m[1])).toBe(expected.rechecked);
      expect(Number(m[2])).toBe(expected.cells);
    }
  });
});

describe("행별 조사 표시 — 재확인 날짜는 재확인한 칸에만", () => {
  it("모든 국가·요금제 칸의 표시가 survey 블록과 맞다", () => {
    const recheck = recheckDateOf(SEED)[0].slice(5);
    const full = SEED.lastUpdated.slice(5);
    for (const row of SEED.prices) {
      for (const plan of Object.keys(row.plans)) {
        const mark = D.surveyCellMark(row, plan);
        const verified = Boolean(row.survey.verified?.[plan]);
        expect(mark.text, `${row.countryCode}.${plan}`).toBe(
          verified ? `재확인 ${recheck}` : `${full} 값 유지`
        );
      }
    }
  });

  it("프리렌더 가격표의 행마다 표시가 붙고, 그 표시가 행의 국가와 맞다", () => {
    const home = buildSections("/youtube-premium").find((s) => s.id === "home").html;
    const rows = [...home.matchAll(/youtube-premium\/([a-z]{2})">[^<]+<\/a> <span class="sp-survey-mark">([^<]+)<\/span>/g)];
    expect(rows.length).toBeGreaterThan(0);
    for (const [, code, text] of rows) {
      const row = SEED.prices.find((p) => p.countryCode.toLowerCase() === code);
      expect(text, code).toBe(D.surveyCellMark(row, "individual").text);
    }
  });

  it("재확인하지 못한 나라의 상세 페이지에는 재확인 날짜가 없다", () => {
    const recheck = recheckDateOf(SEED)[0];
    for (const row of SEED.prices) {
      const text = textOf(`/youtube-premium/${row.countryCode.toLowerCase()}`);
      if (row.survey.recheckedAt) {
        expect(text, row.countryCode).toContain(recheck);
      } else {
        expect(text, row.countryCode).not.toContain(recheck);
        expect(text, row.countryCode).toContain(`요금 조사 ${SEED.lastUpdated}`);
      }
    }
  });
});

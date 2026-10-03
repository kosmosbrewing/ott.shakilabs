/**
 * 데이터 파생 관찰의 게이트.
 *
 * 이 파일이 막으려는 실패는 "숫자는 맞는데 서술이 틀린" 상태다.
 * 산문의 수치는 seo-discoveries.mjs가 시드에서 계산하므로 시드가 바뀌면 저절로 따라
 * 바뀌지만, 그 수치를 둘러싼 주장(부등호 방향·인과·"전부"·"한 곳도")은 따라 바뀌지 않는다.
 * 그래서 여기서는 세 가지를 서로 다른 방식으로 검사한다.
 *
 *  1) 리터럴 앵커 — 시드 값을 하드코딩 숫자와 대조한다. data/prices/*.json이 갱신되면
 *     산문보다 먼저 여기가 red가 되어, 사람이 "그 서술이 아직 참인가"를 다시 보게 만든다.
 *     (계산값끼리 비교하면 상수를 틀리게 바꿔도 산문과 테스트가 같이 움직여 통과한다.)
 *  2) 관계 어서션 — 값이 아니라 부등호·순서·인과를 못 박는다. 숫자가 바뀌어도 관계가
 *     유지되면 통과하고, 관계가 뒤집히면 반드시 실패한다.
 *  3) 반례 전수 스캔 — "전부·모두·한 곳도" 류 주장은 44개국을 다 훑어 예외 수가 0인지 센다.
 *
 * 여기에 더해 소제목(h3)도 본문과 같은 기준으로 검사한다. 소제목이 자기 본문과 모순되는
 * 사고가 실제로 있었다.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as D from "./seo-discoveries.mjs";
import {
  configureSeoContent,
  buildSections,
  buildRichContent,
  getFaqItems,
  normalizeKrwSeed,
  formatShareRange,
} from "./seo-content.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readJson = (rel) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, rel), "utf-8"));

const RAW_SEED = readJson("../../data/prices/youtube-premium.json");
const SERVICES = readJson("../../data/services.json");

configureSeoContent({
  priceSeed: RAW_SEED,
  history: readJson("../../data/history/youtube-premium.json"),
  changelog: readJson("../../data/reports/changelog.json"),
  services: SERVICES,
});

const data = normalizeKrwSeed(RAW_SEED);

const TOOL_ROUTES = ["/", "/youtube-premium", "/youtube-premium/trends"];
const MIN_BODY_CHARS = 5000;
const MAX_PAIR_SIMILARITY = 0.5;

const stripTags = (html) =>
  String(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const textOf = (route) => stripTags(buildRichContent(route));
const countChars = (route) => textOf(route).replace(/\s+/g, "").length;

/** h3 소제목만 뽑는다 — 소제목의 수치 주장도 본문과 같은 기준으로 검사하기 위해. */
function headingsOf(route) {
  return buildSections(route)
    .flatMap((section) => [...section.html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)])
    .map((match) => stripTags(match[1]));
}

function headingWith(route, needle) {
  const found = headingsOf(route).filter((h) => h.includes(needle));
  expect(found, `소제목에 "${needle}"를 담은 h3가 정확히 1개여야 한다`).toHaveLength(1);
  return found[0];
}

/** 문자 bigram Dice 계수 — 한국어는 어절 토큰화가 불안정해 문자 기반으로 잰다. */
function dice(a, b) {
  const grams = (text) => {
    const compact = text.replace(/\s+/g, "");
    const map = new Map();
    for (let i = 0; i < compact.length - 1; i += 1) {
      const gram = compact.slice(i, i + 2);
      map.set(gram, (map.get(gram) || 0) + 1);
    }
    return map;
  };
  const A = grams(a);
  const B = grams(b);
  let intersection = 0;
  let totalA = 0;
  let totalB = 0;
  for (const value of A.values()) totalA += value;
  for (const value of B.values()) totalB += value;
  for (const [gram, count] of A) {
    if (B.has(gram)) intersection += Math.min(count, B.get(gram));
  }
  return totalA + totalB === 0 ? 0 : (2 * intersection) / (totalA + totalB);
}

/** 숫자를 지운 뒤에도 유사하면 "같은 글에 숫자만 갈아 끼운" 상태다. */
const maskNumbers = (text) => text.replace(/[0-9][0-9,.]*/g, "#");

// =========================================================================
// 1) 리터럴 앵커 — 시드가 바뀌면 산문보다 먼저 여기가 red가 된다
// =========================================================================
describe("리터럴 앵커: 시드 값 자체", () => {
  it("가격 시드의 헤더 값", () => {
    // 2026-10-03 재조사 회차. 국가별 확인 여부는 각 행의 survey 필드(price-survey.test.mjs가 검사)
    expect(RAW_SEED.lastUpdated).toBe("2026-10-03");
    expect(RAW_SEED.exchangeRateDate).toBe("2026-08-22");
    expect(RAW_SEED.krwRate).toBe(1385.741836);
    expect(RAW_SEED.baseCountry).toBe("KR");
    expect(RAW_SEED.baseCurrency).toBe("USD");
    expect(RAW_SEED.prices).toHaveLength(44);
  });

  it("본문이 이름을 부르는 국가들의 현지 정가·환산값", () => {
    const of = (name) => RAW_SEED.prices.find((p) => p.country === name);
    expect(of("한국").plans.individual.monthly).toBe(14900);
    expect(of("한국").plans.lite.monthly).toBe(8500);
    expect(of("한국").converted.individual.krw).toBe(14897); // 왕복 환산 결과(보정 전)
    expect(of("한국").plans.family).toBeUndefined();
    expect(of("나이지리아").plans.individual.monthly).toBe(1700);
    expect(of("나이지리아").converted.individual.krw).toBe(1746);
    expect(of("스위스").plans.individual.monthly).toBe(17.9);
    expect(of("스위스").converted.individual.krw).toBe(30971);
    expect(of("스위스").converted.family.krw).toBe(58658);
    expect(of("뉴질랜드").converted.individual.krw).toBe(14911);
    expect(of("캐나다").converted.individual.krw).toBe(14079);
    expect(of("호주").converted.lite.krw).toBe(8924);
    expect(of("칠레").plans.family.monthly).toBe(9900);
    expect(of("대만").plans.family.monthly).toBe(479);
    expect(of("독일").plans.individual.monthly).toBe(12.99);
    expect(of("독일").plans.family.monthly).toBe(29.99);
    expect(of("네덜란드").plans.individual.monthly).toBe(13.99);
    expect(of("네덜란드").plans.family.monthly).toBe(25.99);
    expect(of("베트남").plans.individual.monthly).toBe(79000);
    // 2026-10-03 공식 확인으로 인상 반영(13.99→15.99). 트렌드 본문이 "월 2만원 이상" 예시로 부른다
    expect(of("미국").plans.individual.monthly).toBe(15.99);
    expect(of("미국").converted.individual.krw).toBe(22158);
  });

  it("파생 집계값", () => {
    expect(D.planCoverage(data).counts).toEqual({
      individual: 44,
      family: 43,
      lite: 6,
      duo: 4,
    });
    expect(D.planCoverage(data).cells).toBe(97);
    expect(D.currencyStructure(data).currencyCount).toBe(39);
    expect(D.currencyStructure(data).totalPairs).toBe(946);
    expect(D.currencyStructure(data).sameCurrencyPairs).toBe(15);
    expect(D.globalSpread(data).spread).toBe(17.7);
    expect(D.surveyDateGapDays(data)).toBe(42);
    expect(D.planCombinations(data)).toHaveLength(5);
    expect(D.familyMultiples(data).count).toBe(43);
    expect(D.fxRankThresholds(data).asymmetryRatio).toBe(82.2);
    expect(D.fxRankThresholds(data).within20).toHaveLength(6);
    expect(D.baseNeighborhood(data).rankAsc).toBe(28);
    expect(D.adjacentGaps(data).big).toHaveLength(9);
    // 미국 개인 요금 인상(2026-10-03 확인)으로 미국 행이 32위 → 35위
    expect(D.litePlans(data).ranks).toEqual([2, 3, 28, 35, 40, 41]);
  });
});

// =========================================================================
// 2) 관계 어서션 — 값이 아니라 부등호·순서·인과를 못 박는다
// =========================================================================
describe("관계: 루트 허브가 주장하는 것", () => {
  it("선언된 요금제 칸보다 실제로 채워진 칸이 적다", () => {
    const coverage = D.planCoverage(data);
    const declared =
      SERVICES.services.find((s) => s.id === RAW_SEED.serviceId).plans.length;
    expect(coverage.cells).toBeLessThan(coverage.countryCount * declared);
    // "개인만 전 국가에 있다" — 나머지는 반드시 그보다 적어야 문장이 참이다
    expect(coverage.counts.individual).toBe(coverage.countryCount);
    expect(coverage.counts.family).toBeLessThan(coverage.counts.individual);
    expect(coverage.counts.lite).toBeLessThan(coverage.counts.family);
    expect(coverage.counts.duo).toBeLessThan(coverage.counts.lite);
  });

  it("패밀리가 빠진 나라는 기준 국가 하나뿐이다", () => {
    const coverage = D.planCoverage(data);
    const base = data.prices.find((p) => p.countryCode === data.baseCountry);
    expect(coverage.missingFamily).toEqual([base.country]);
  });

  it("라이트는 중간 순위 구간에 한 곳도 없다", () => {
    const lite = D.litePlans(data);
    const inGap = lite.members.filter(
      (m) => m.rank >= lite.gapStart && m.rank <= lite.gapEnd
    );
    expect(inGap).toHaveLength(0); // 반례 전수 스캔
    expect(lite.gapLength).toBeGreaterThanOrEqual(20);
    // "양 끝에만 있다" — 최저가권과 고가권 양쪽에 실제로 있어야 참이다
    expect(Math.min(...lite.ranks)).toBeLessThanOrEqual(5);
    expect(Math.max(...lite.ranks)).toBeGreaterThanOrEqual(lite.members.length + 34);
  });

  it("공유 통화는 하나뿐이고, 직접 비교 쌍은 그 통화 안에서만 나온다", () => {
    const currency = D.currencyStructure(data);
    expect(currency.shared).toHaveLength(1);
    const shared = currency.shared[0];
    expect(currency.sameCurrencyPairs).toBe(
      (shared.countries.length * (shared.countries.length - 1)) / 2
    );
    expect(currency.convertedPairs).toBe(
      currency.totalPairs - currency.sameCurrencyPairs
    );
    expect(currency.convertedPairs).toBeGreaterThan(currency.sameCurrencyPairs);
  });

  it("표기 관습 집계가 서로 모순되지 않는다", () => {
    const notation = D.notationConventions(data);
    expect(notation.decimals + notation.integers).toBe(data.prices.length);
    expect(notation.decimal99).toBeLessThanOrEqual(notation.decimals);
    expect(notation.lastDigitNine).toBeGreaterThan(data.prices.length / 2);
  });

  it("원화 칸은 전부 달러값의 파생이고, 기준국만 왕복 오차가 남는다", () => {
    const audit = D.conversionAudit(RAW_SEED);
    expect(audit.mismatches).toHaveLength(0); // 반례 전수 스캔: 97칸 모두 재현
    expect(audit.checked).toBe(D.planCoverage(data).cells);
    // 왕복 오차가 실재해야 "그래서 되돌려 쓴다"는 문장이 참이 된다
    expect(audit.roundTrip.length).toBeGreaterThan(0);
    for (const row of audit.roundTrip) {
      expect(row.local).not.toBe(row.derived);
    }
    // 보정이 실제로 적용돼 화면·정적 HTML은 현지 정가를 쓴다
    const base = data.prices.find((p) => p.countryCode === data.baseCountry);
    expect(base.converted.individual.krw).toBe(base.plans.individual.monthly);
  });

  it("연 요금 축은 비어 있고 월 요금 축은 꽉 차 있다", () => {
    const billing = D.billingPeriodCoverage(data);
    expect(billing.yearly).toBe(0); // 반례 전수 스캔
    expect(billing.monthly).toBe(billing.cells);
  });

  it("절약률 분모를 뒤집으면 퍼센트가 커진다 (부등호 방향)", () => {
    const denom = D.savingsDenominatorAsymmetry(data);
    // 산문: "같은 격차가 88.3%로도 753.4%로도 읽힌다" — 뒤쪽이 커야 주장이 성립한다
    expect(denom.pricierPercentFromCheapest).toBeGreaterThan(
      denom.cheaperPercentFromBase
    );
    // 절약률은 구조상 100%를 넘을 수 없다
    expect(denom.cheaperPercentFromBase).toBeLessThan(100);
    expect(denom.maxSavingsPercent).toBeLessThan(100);
    expect(denom.maxMarkupPercent).toBeGreaterThan(100);
  });
});

describe("관계: 가격표 페이지가 주장하는 것", () => {
  it("$10~15 구간이 양옆보다 성기다 (골짜기)", () => {
    const bands = D.usdBandDensity(data);
    const low = bands.find((b) => b.lo === 5);
    const mid = bands.find((b) => b.lo === 10);
    const high = bands.find((b) => b.lo === 15);
    expect(mid.density).toBeLessThan(low.density);
    expect(mid.density).toBeLessThan(high.density);
    // 기준국이 그 골짜기 안에 있어야 다음 문단이 성립한다
    const base = D.individualsByKrw(data).find(
      (r) => r.code === data.baseCountry
    );
    expect(base.usd).toBeGreaterThanOrEqual(mid.lo);
    expect(base.usd).toBeLessThan(mid.hi);
  });

  it("기준국 ±5% 안에 더 싼 나라가 한 곳도 없다 (아래쪽 벽)", () => {
    const n = D.baseNeighborhood(data);
    expect(n.cheaperWithin).toHaveLength(0); // 반례 전수 스캔
    expect(n.within.length).toBeGreaterThan(0);
    for (const row of n.within) expect(row.krw).toBeGreaterThan(n.baseKrw);
    // "위쪽은 붙어 있고 아래쪽은 멀다" — 간격 비교가 주장의 핵심
    const gapUp = n.within[0].krw - n.baseKrw;
    const gapDown = n.baseKrw - n.nearestCheaper.krw;
    expect(gapUp).toBeLessThan(gapDown);
    expect(Math.abs(n.nearestCheaperGapPercent)).toBeGreaterThan(
      n.tolerance * 100
    );
  });

  it("인접 격차는 내림차순이고 기준국보다 비싼 쪽에도 큰 계단이 있다", () => {
    const big = D.adjacentGaps(data).big;
    for (let i = 1; i < big.length; i += 1) {
      expect(big[i - 1].percent).toBeGreaterThanOrEqual(big[i].percent);
    }
    const baseKrw = D.baseCountryKrw(data);
    expect(big.filter((g) => g.fromKrw >= baseKrw).length).toBeGreaterThan(0);
  });

  it("아프리카는 평균 < 중앙값, 북미는 평균 > 중앙값 (방향이 반대)", () => {
    const stats = D.continentStats(data);
    const africa = stats.find((c) => c.continent === "africa");
    const northAmerica = stats.find((c) => c.continent === "north-america");
    expect(africa.mean).toBeLessThan(africa.median);
    expect(africa.meanOverMedian).toBeLessThan(1);
    expect(northAmerica.mean).toBeGreaterThan(northAmerica.median);
    expect(northAmerica.meanOverMedian).toBeGreaterThan(1);
  });

  it("유럽 내부 격차가 아시아보다 크고 전체보다는 작다", () => {
    const stats = D.continentStats(data);
    const europe = stats.find((c) => c.continent === "europe");
    const asia = stats.find((c) => c.continent === "asia");
    expect(europe.spread).toBeGreaterThan(asia.spread);
    // "유럽 하나가 전체 격차의 대부분을 덮는다" — 전체를 넘어설 수는 없다
    expect(europe.spread).toBeLessThan(D.globalSpread(data).spread);
    expect(Math.log(europe.spread) / Math.log(D.globalSpread(data).spread)).toBeGreaterThan(0.8);
  });

  it("패밀리가 개인의 정확히 두 배인 나라가 한 곳도 없다", () => {
    const family = D.familyMultiples(data);
    expect(family.exactlyTwo).toBe(0); // 반례 전수 스캔(현지 통화 기준)
    expect(family.underTwo + family.overTwo).toBe(family.count);
    expect(family.min.multiple).toBeLessThan(2);
    expect(family.max.multiple).toBeGreaterThan(2);
    // 손익분기 인원은 배수에서 바로 나와야 한다
    expect(family.breakEvenTwo).toBe(family.underTwo);
    expect(family.breakEvenThree).toBe(family.overTwo);
    for (const row of family.rows) {
      expect(row.breakEvenHeads * row.individualLocal).toBeGreaterThan(row.familyLocal);
      expect((row.breakEvenHeads - 1) * row.individualLocal).toBeLessThanOrEqual(row.familyLocal);
    }
  });

  it("원화 환산으로 배수를 재면 정확히 두 배로 보이는 사례가 실재한다", () => {
    // 본문이 "반올림이 만든 착시"라고 말하려면 그런 나라가 있어야 한다
    const illusions = D.familyMultiples(data).rows.filter((r) => {
      const row = data.prices.find((p) => p.country === r.country);
      return (
        r.multiple !== 2 &&
        row?.converted?.family?.krw === row?.converted?.individual?.krw * 2
      );
    });
    expect(illusions.length).toBeGreaterThan(0);
  });

  it("역전 쌍은 개인·패밀리 부등호가 서로 반대다", () => {
    const reversals = D.familyRankReversals(data);
    expect(reversals.count).toBeGreaterThan(0);
    for (const pair of reversals.top) {
      expect(pair.a.individual).toBeLessThan(pair.b.individual);
      expect(pair.a.family).toBeGreaterThan(pair.b.family);
    }
  });

  it("유로존은 환율 없이도 개인↔패밀리가 뒤집힌다", () => {
    const euro = D.eurozoneContrast(data);
    expect(euro.reversed).toBe(true);
    expect(new Set(euro.members.map((m) => m.country)).size).toBe(euro.members.length);
    for (const cheap of euro.cheapGroup) {
      for (const other of euro.otherGroup) {
        expect(cheap.individual).toBeLessThan(other.individual);
        expect(cheap.family).toBeGreaterThan(other.family);
      }
    }
  });

  it("패밀리 분담: 4명은 43개국 전부 참, 3명에서 무너진다 (경계)", () => {
    const split = D.familySplitThresholds(data);
    const heads4 = split.levels.find((l) => l.heads === 4);
    const heads3 = split.levels.find((l) => l.heads === 3);
    // 무조건 단언이 참인 구간 — 반례 전수 스캔
    expect(heads4.failing).toHaveLength(0);
    expect(heads4.passing).toBe(split.total);
    // 그리고 그 단언이 깨지는 경계가 실제로 존재해야 "4명까지만 참"이 참이다
    expect(heads3.passing).toBeLessThan(split.total);
    expect(heads3.failing.length).toBeGreaterThan(0);
    // 인원이 줄수록 통과 국가 수는 단조 감소해야 한다
    const byHeads = [...split.levels].sort((a, b) => b.heads - a.heads);
    for (let i = 1; i < byHeads.length; i += 1) {
      expect(byHeads[i].passing).toBeLessThanOrEqual(byHeads[i - 1].passing);
    }
  });

  it("라이트로 비교하면 두 나라 격차가 줄어든다 (인과 방향)", () => {
    const lite = D.litePlans(data);
    const outlier = lite.minRatio;
    const base = lite.members.find((m) => m.code === data.baseCountry);
    expect(base).toBeDefined();
    const individualRatio = outlier.individual / base.individual;
    const liteRatio = outlier.lite / base.lite;
    // 산문: "개인은 1.53배인데 라이트는 1.05배" — 반드시 라이트 쪽이 작아야 한다
    expect(liteRatio).toBeLessThan(individualRatio);
    // 그 원인은 아웃라이어의 할인 폭이 나머지보다 크다는 것
    for (const member of lite.members) {
      if (member.country === outlier.country) continue;
      expect(outlier.ratio).toBeLessThan(member.ratio);
    }
  });

  it("듀오는 2인분보다 좁게 모이고 패밀리 대비는 넓게 흩어진다", () => {
    const duo = D.duoPlans(data);
    expect(duo.length).toBeGreaterThan(0);
    const soloSpan =
      Math.max(...duo.map((x) => x.vsTwoSolo)) - Math.min(...duo.map((x) => x.vsTwoSolo));
    const familyValues = duo.filter((x) => x.vsFamily != null).map((x) => x.vsFamily);
    const familySpan = Math.max(...familyValues) - Math.min(...familyValues);
    expect(familySpan).toBeGreaterThan(soloSpan);
    for (const row of duo) {
      expect(row.vsTwoSolo).toBeGreaterThan(0.7);
      expect(row.vsTwoSolo).toBeLessThan(0.8);
    }
  });
});

describe("관계: 트렌드 페이지가 주장하는 것", () => {
  it("환율을 어떻게 바꿔도 외국끼리의 순서는 바뀌지 않는다", () => {
    // 본문의 가장 강한 주장. 스칼라 배수라는 성질을 실제로 스캔해 확인한다.
    const foreign = D.individualsByKrw(data).filter(
      (r) => r.code !== data.baseCountry
    );
    const reference = foreign.map((r) => r.code);
    let reordered = 0;
    for (let factor = 0.5; factor <= 2.0001; factor += 0.05) {
      const scenario = [...foreign]
        .sort((a, b) => a.usd * factor - b.usd * factor)
        .map((r) => r.code);
      if (JSON.stringify(scenario) !== JSON.stringify(reference)) reordered += 1;
    }
    expect(reordered).toBe(0); // 반례 전수 스캔
    expect(D.orderingInvariance(data).mismatchCount).toBe(0);
  });

  it("기준국 순위는 내려갈 때가 올라갈 때보다 훨씬 예민하다 (비대칭 방향)", () => {
    const fx = D.fxRankThresholds(data);
    const down = fx.crossings.filter((c) => c.deltaPercent < 0);
    const up = fx.crossings.filter((c) => c.deltaPercent > 0);
    const nearestDown = down[down.length - 1];
    const nearestUp = up[0];
    expect(Math.abs(nearestDown.deltaPercent)).toBeLessThan(nearestUp.deltaPercent);
    expect(fx.asymmetryRatio).toBeGreaterThan(1);
    // 방향의 의미: 환율이 내려가면 순위가 나빠지고(숫자 증가) 올라가면 좋아진다
    expect(nearestDown.rankAfter).toBeGreaterThan(fx.crossings.length + 1 - fx.crossings.length + D.baseNeighborhood(data).rankAsc - 1);
    expect(nearestDown.rankAfter).toBe(D.baseNeighborhood(data).rankAsc + 1);
    expect(nearestUp.rankAfter).toBe(D.baseNeighborhood(data).rankAsc - 1);
  });

  it("데드존이 실재한다 — 세 번째와 네 번째 임계 사이가 넓다", () => {
    const down = D.fxRankThresholds(data)
      .crossings.filter((c) => c.deltaPercent < 0)
      .sort((a, b) => b.deltaPercent - a.deltaPercent);
    const third = down[2];
    const fourth = down[3];
    const width = Math.abs(fourth.deltaPercent) - Math.abs(third.deltaPercent);
    expect(width).toBeGreaterThan(10);
    // 그 구간 안에서는 순위가 정말 고정인지 직접 확인한다
    const baseKrw = D.baseCountryKrw(data);
    const foreign = D.individualsByKrw(data).filter((r) => r.code !== data.baseCountry);
    const rankAt = (deltaPercent) =>
      foreign.filter(
        (r) => r.usd * data.krwRate * (1 + deltaPercent / 100) < baseKrw
      ).length + 1;
    const inside = [];
    for (let d = third.deltaPercent - 0.2; d > fourth.deltaPercent + 0.2; d -= 0.5) {
      inside.push(rankAt(d));
    }
    expect(new Set(inside).size).toBe(1);
    expect(inside[0]).toBe(third.rankAfter);
  });

  it("±20% 안의 임계는 환율이 오를수록 순위가 좋아지는 방향으로 정렬된다", () => {
    const within = D.fxRankThresholds(data).within20;
    for (let i = 1; i < within.length; i += 1) {
      expect(within[i].deltaPercent).toBeGreaterThan(within[i - 1].deltaPercent);
      expect(within[i].rankAfter).toBeLessThan(within[i - 1].rankAfter);
    }
    const span = D.fxRankScenarios(data, [-20, 20]);
    expect(span[0].rank).toBeGreaterThan(span[1].rank);
  });

  it("같은 표시 숫자라도 통화가 다르면 격차가 제각각이다", () => {
    const collisions = D.numeralCollisions(data);
    expect(collisions.length).toBeGreaterThan(1);
    // 내림차순 정렬이어야 본문의 "가장 좁은/가장 넓은" 선택이 맞는다
    for (let i = 1; i < collisions.length; i += 1) {
      expect(collisions[i - 1].spread).toBeGreaterThanOrEqual(collisions[i].spread);
    }
    const widest = collisions[0];
    const tightest = collisions[collisions.length - 1];
    expect(tightest.spread).toBeLessThan(widest.spread);
    expect(tightest.spread).toBeGreaterThanOrEqual(1);
    for (const collision of collisions) {
      expect(new Set(collision.entries.map((e) => e.currency)).size).toBeGreaterThan(1);
    }
  });

  it("표시가 크기 순서와 원화 순위가 어긋난다", () => {
    const magnitude = D.numeralMagnitudeContrast(data);
    const half = magnitude.total / 2;
    // 표시가가 가장 작은 나라들은 실제로는 비싼 쪽(순위 후반)에 있다
    for (const row of magnitude.smallest) expect(row.rank).toBeGreaterThan(half);
    // 표시가가 가장 큰 나라는 실제로는 싼 쪽에 있다
    expect(magnitude.largest.rank).toBeLessThan(half);
  });

  it("원화 동률은 전부 진짜 동률이고, 환산이 만든 가짜는 0건이다", () => {
    const ties = D.krwTies(data);
    expect(ties.artificial).toBe(0); // 반례 전수 스캔
    expect(ties.ties.length).toBeGreaterThan(0);
    for (const tie of ties.ties) {
      expect(tie.genuine).toBe(true);
      expect(new Set(tie.members.map((m) => m.local)).size).toBe(1);
    }
  });

  it("'월 2만원 이상'으로 이름을 부른 나라는 전부 실제로 2만원 이상이다", () => {
    // 본문: "미국·영국·북유럽·스위스·호주 등 N개국은 월 2만원 이상" — 예시가 하나라도
    // 2만원 아래면 문장이 거짓이 된다(2026-02-20 시드의 미국 19,387원이 그 상태였다).
    const named = ["US", "GB", "SE", "DK", "NO", "CH", "AU"];
    const rows = D.individualsByKrw(data);
    for (const code of named) {
      const row = rows.find((r) => r.code === code);
      expect(row, `${code} 행이 있어야 한다`).toBeDefined();
      expect(row.krw, `${code}는 2만원 이상이어야 한다`).toBeGreaterThanOrEqual(20000);
    }
  });

  it("왕복 오차는 순위 경계와 같은 자릿수지만 이 순위를 뒤집지는 않는다", () => {
    const audit = D.conversionAudit(RAW_SEED);
    const roundTrip = audit.roundTrip.find((r) => r.planId === "individual");
    const neighborhood = D.baseNeighborhood(data);
    const gap = neighborhood.within[0].krw - neighborhood.baseKrw;
    const error = Math.abs(roundTrip.local - roundTrip.derived);
    expect(error).toBeGreaterThan(0);
    expect(error / gap).toBeGreaterThan(0.1); // "같은 자릿수"
    // 그런데 본문은 "그래도 순위는 안 바뀐다"고 말한다 — 그것도 확인한다
    expect(roundTrip.derived).toBeLessThan(neighborhood.within[0].krw);
  });
});

// =========================================================================
// 3) 소제목도 본문과 같은 기준으로 — h3가 자기 본문과 모순되면 잡는다
// =========================================================================
describe("소제목의 수치 주장", () => {
  const numbersIn = (text) =>
    [...text.matchAll(/[0-9]+(?:\.[0-9]+)?/g)].map((m) => Number(m[0]));

  it("루트: 요금제 칸 소제목의 두 숫자가 계산값과 같다", () => {
    const coverage = D.planCoverage(data);
    const declared =
      SERVICES.services.find((s) => s.id === RAW_SEED.serviceId).plans.length;
    const heading = headingWith("/", "요금제 칸");
    expect(numbersIn(heading)).toEqual([
      coverage.countryCount * declared,
      coverage.cells,
    ]);
  });

  it("루트: 조합 가짓수 소제목이 실제 조합 수와 같다", () => {
    const heading = headingWith("/", "요금제 조합은");
    expect(numbersIn(heading)).toEqual([
      data.prices.length,
      D.planCombinations(data).length,
    ]);
  });

  it("루트: 분모 비대칭 소제목의 두 퍼센트가 본문 계산과 같다", () => {
    const denom = D.savingsDenominatorAsymmetry(data);
    const heading = headingWith("/", "로도 읽힙니다");
    expect(numbersIn(heading)).toEqual([
      denom.cheaperPercentFromBase,
      denom.pricierPercentFromCheapest,
    ]);
    // 소제목이 "작은 값 → 큰 값" 순서로 읽히는지까지 본다
    expect(numbersIn(heading)[0]).toBeLessThan(numbersIn(heading)[1]);
  });

  it("가격표: 격차 배수 소제목이 계산값과 같다", () => {
    const heading = headingWith("/youtube-premium", "격차는");
    expect(numbersIn(heading)).toContain(D.globalSpread(data).spread);
  });

  it("가격표: 분담 인원 소제목의 경계가 계산값과 같다", () => {
    const split = D.familySplitThresholds(data);
    const heads4 = split.levels.find((l) => l.heads === 4);
    const heads3 = split.levels.find((l) => l.heads === 3);
    const heading = headingWith("/youtube-premium", "명이 나누면");
    // "4명이 나누면 43개국 전부가 …, 3명이면 무너집니다"
    expect(numbersIn(heading)).toEqual([heads4.heads, heads4.passing, heads3.heads]);
    expect(heads4.passing).toBe(split.total);
  });

  it("가격표: 손익분기 소제목의 국가 수가 계산값과 같다", () => {
    const family = D.familyMultiples(data);
    const heading = headingWith("/youtube-premium", "둘이 나눠 쓰면 이득");
    expect(numbersIn(heading)).toEqual([family.breakEvenTwo]);
    expect(family.breakEvenTwo).toBeLessThan(family.count);
  });

  it("가격표: 역전 쌍 소제목이 전수 계산과 같다", () => {
    const heading = headingWith("/youtube-premium", "뒤집히는 조합이");
    expect(numbersIn(heading)).toEqual([D.familyRankReversals(data).count]);
  });

  it("트렌드: 비대칭 배수 소제목이 계산값과 같다", () => {
    const heading = headingWith("/youtube-premium/trends", "비대칭");
    expect(numbersIn(heading)).toContain(D.fxRankThresholds(data).asymmetryRatio);
  });

  it("트렌드: 임계 지점 개수 소제목이 계산값과 같다", () => {
    const heading = headingWith("/youtube-premium/trends", "순위가 바뀌는 지점은");
    expect(numbersIn(heading)).toEqual([20, D.fxRankThresholds(data).within20.length]);
  });

  it("트렌드: 동률 국가 수 소제목이 계산값과 같다", () => {
    const heading = headingWith("/youtube-premium/trends", "동률");
    expect(numbersIn(heading)).toEqual([D.krwTies(data).tiedCountries]);
  });
});

// =========================================================================
// 4) 산문이 실제로 데이터를 읽고 있는가 — 값이 문장에 도달하는지
// =========================================================================
describe("산문 ↔ 데이터 배선", () => {
  it("계산값이 본문에 그대로 등장한다", () => {
    const home = textOf("/youtube-premium");
    const trends = textOf("/youtube-premium/trends");
    const landing = textOf("/");
    const fmt = (value) => Math.round(value).toLocaleString("ko-KR");

    expect(home).toContain(`${D.globalSpread(data).spread}배`);
    expect(home).toContain(fmt(D.globalSpread(data).cheapest.krw));
    expect(home).toContain(fmt(D.globalSpread(data).priciest.krw));
    expect(home).toContain(`${D.familyMultiples(data).min.multiple}배`);
    expect(home).toContain(`${D.familyMultiples(data).max.multiple}배`);
    expect(trends).toContain(String(D.fxRankThresholds(data).asymmetryRatio));
    expect(trends).toContain(
      Number(D.fxRankThresholds(data).within20[0].rateNeeded).toLocaleString("ko-KR")
    );
    expect(trends).toContain(String(D.surveyDateGapDays(data)));
    expect(landing).toContain(String(D.currencyStructure(data).currencyCount));
    expect(landing).toContain(String(D.planCoverage(data).cells));
    // 환율은 시드 원값 그대로 실려야 "달러값 × 이 수" 검산이 재현된다
    expect(landing).toContain(
      Number(data.krwRate).toLocaleString("ko-KR", { maximumFractionDigits: 8 })
    );
  });

  it("교정한 하드코딩 수치가 되살아나지 않았다", () => {
    // 전부 시드와 어긋났던 옛 문구다. 되돌아오면 표와 본문이 다시 갈라진다.
    const all = TOOL_ROUTES.map(textOf).join(" ");
    for (const stale of [
      "월 2천원대",
      "8배 이상",
      "2,374원",
      "2,635원",
      "약 50~60%",
      "개인·가족·학생·Lite 플랜",
    ]) {
      expect(all).not.toContain(stale);
    }
  });
});

// =========================================================================
// 5) 정직성 게이트 — 시점 간 변동 주장 금지, 두 날짜 분리 표기
// =========================================================================
describe("정직성", () => {
  it("시점 간 가격 변동을 주장하는 표현이 없다", () => {
    // 단어 자체를 막으면 "시점 간 가격 변동은 표시하지 않습니다" 같은 정직한 부정문까지
    // 걸린다. 막아야 하는 것은 주장이므로 긍정 술어가 붙은 형태만 금지한다.
    const bannedPhrases = [
      "최근 인상",
      "인상·인하",
      "인하 국가",
      "가격 변동 트렌드",
      "전월 대비",
      "지난 조사 대비",
      "대비 상승",
      "대비 하락",
    ];
    const bannedClaims = [
      /가격\s*변동\s*추이를?\s*(제공|표시|보여)/,
      /변동률을?\s*(제공|표시)합니다/,
      /(가격|요금)이\s*(올랐습니다|내렸습니다|상승했습니다|하락했습니다)/,
      /실시간[^.]{0,20}(제공합니다|갱신합니다|반영합니다|비교합니다)/,
      /(최신|매일)\s*(가격|요금)을?\s*(제공|반영|갱신)/,
    ];
    for (const route of TOOL_ROUTES) {
      const text = textOf(route);
      for (const phrase of bannedPhrases) {
        expect(text, `${route}에 "${phrase}"가 있으면 안 된다`).not.toContain(phrase);
      }
      for (const claim of bannedClaims) {
        expect(text, `${route}가 ${claim}에 해당하는 주장을 하면 안 된다`).not.toMatch(claim);
      }
    }
  });

  it("관측 스냅샷이 없으므로 시점 비교표 자체가 렌더되지 않는다", () => {
    // 구조적 보증: 문구가 아니라 "표가 존재할 수 있는가"를 막는다.
    const history = readJson("../../data/history/youtube-premium.json");
    expect(history.snapshots).toHaveLength(0);
    const trends = textOf("/youtube-premium/trends");
    expect(trends).not.toContain("관측 시점별 원화 환산 가격");
    expect(trends).not.toContain("직전 대비");
  });

  it("트렌드 페이지는 조사 1회분이라는 사실을 명시한다", () => {
    const text = textOf("/youtube-premium/trends");
    expect(text).toContain("시점 간 가격 변동은 표시하지 않습니다");
    expect(text).toContain("1회분");
  });

  it("환율 시나리오는 가정임을 밝히고 전망으로 읽히지 않는다", () => {
    const text = textOf("/youtube-premium/trends");
    expect(text).toContain("가정 시나리오");
    expect(text).toContain("환율 예측이 아니라");
    for (const phrase of ["예상 환율", "오를 것으로", "내릴 것으로", "전망됩니다"]) {
      expect(text).not.toContain(phrase);
    }
    expect(text).not.toMatch(/환율\s*전망(?!이 아닙니다)/);
  });

  it("두 날짜는 어느 페이지에서도 따로, 항상 함께 표기된다", () => {
    for (const route of TOOL_ROUTES) {
      const text = textOf(route);
      // 한쪽만 실리면 독자가 그 하나를 "데이터 기준일"로 읽는다
      expect(text).toContain(data.lastUpdated);
      expect(text).toContain(data.exchangeRateDate);
      // 두 날짜를 하나로 묶어 부르는 표현 금지
      expect(text).not.toContain(`데이터 기준일: ${data.lastUpdated}`);
      expect(text).not.toContain(`${data.lastUpdated} ~ ${data.exchangeRateDate}`);
      expect(text).not.toMatch(/기준일\s*[::]?\s*2026-02-20\s*[~·,]\s*2026-08-22/);
    }
  });

  it("환율 불변 주장이 두 층으로 한정돼 FAQ와 부딪히지 않는다", () => {
    // 이 표는 통화별 대달러 환율을 갖고 있지 않고 달러-원 배수 하나만 갖는다.
    // 그 구분을 빼면 "환율이 움직여도 순위는 안 바뀐다"가 같은 페이지 FAQ
    // ("환율이 바뀌면 순위도 바뀌나요")와 정면으로 부딪힌다.
    const text = textOf("/youtube-premium/trends");
    expect(text).toContain("두 층");
    expect(text).toContain("각국 통화 → 달러");
    expect(text).toContain("달러 → 원");
    expect(text).toContain("②만 움직이면");
    // FAQ 답변도 같은 구분을 해야 한다
    const faq = getFaqItems("/youtube-premium/trends")
      .map((item) => stripTags(item.a))
      .join(" ");
    expect(faq).toContain("대달러 환율");
    expect(faq).toContain("달러-원 환율");
    // 무조건적인 "환율은 순위를 바꾸지 않는다"는 남아 있으면 안 된다
    expect(text).not.toMatch(/환율은[^.]{0,10}순위를 바꾸지 않습니다/);
  });

  it("갱신 주기를 약속하지 않는다", () => {
    const all = TOOL_ROUTES.map(textOf).join(" ");
    for (const phrase of ["매일 갱신", "매주 갱신", "매월 갱신", "정기적으로 갱신", "주기적으로 갱신"]) {
      expect(all).not.toContain(phrase);
    }
    // "실시간"은 부정문("실시간 시계열은 제공하지 않습니다")에서 쓰이므로 단어가 아니라
    // 약속하는 형태만 막는다.
    expect(all).not.toMatch(/실시간(으로)?\s*(갱신|반영|수집|업데이트)(합니다|됩니다|하고)/);
  });
});

// =========================================================================
// 6) 분량과 중복 — 세 페이지가 같은 데이터를 쓰므로 여기가 관건이다
// =========================================================================
describe("분량과 중복", () => {
  it.each(TOOL_ROUTES)("%s 본문이 %d자 이상", (route) => {
    expect(countChars(route)).toBeGreaterThanOrEqual(MIN_BODY_CHARS);
  });

  it("세 페이지 전 쌍의 유사도가 마스킹 전후 모두 0.5 미만", () => {
    const texts = Object.fromEntries(TOOL_ROUTES.map((r) => [r, textOf(r)]));
    for (let i = 0; i < TOOL_ROUTES.length; i += 1) {
      for (let j = i + 1; j < TOOL_ROUTES.length; j += 1) {
        const a = texts[TOOL_ROUTES[i]];
        const b = texts[TOOL_ROUTES[j]];
        const raw = dice(a, b);
        const masked = dice(maskNumbers(a), maskNumbers(b));
        expect(raw, `${TOOL_ROUTES[i]} vs ${TOOL_ROUTES[j]} raw`).toBeLessThan(
          MAX_PAIR_SIMILARITY
        );
        expect(
          masked,
          `${TOOL_ROUTES[i]} vs ${TOOL_ROUTES[j]} masked`
        ).toBeLessThan(MAX_PAIR_SIMILARITY);
      }
    }
  });

  it("소제목은 세 페이지에 걸쳐 중복되지 않는다", () => {
    const all = TOOL_ROUTES.flatMap(headingsOf);
    expect(new Set(all).size).toBe(all.length);
  });
});

// =========================================================================
// 범위 표기 — "A~B" 양 끝이 같은 값으로 뭉개지지 않는다 (2026-10-03)
// 메인 문서가 "한국 가격의 15~15% 수준"이라고 썼다: 인도 14.5%·튀르키예 15.4%를 정수로 반올림해
// 양 끝이 같아졌다. 숫자는 시드에서 나와 맞았지만 범위라는 서술이 무너졌다.
// =========================================================================
describe("범위 표기", () => {
  const RANGE = /(\d[\d,.]*)\s*~\s*(\d[\d,.]*)\s*(%|원|개국|배)/g;

  it("formatShareRange는 양 끝이 갈라지는 자릿수를 고르고, 같은 값은 범위로 쓰지 않는다", () => {
    expect(formatShareRange(2162 / 14900, 2300 / 14900)).toBe("14.5~15.4%");
    expect(formatShareRange(0.2, 0.1)).toBe("10~20%");
    expect(formatShareRange(0.15012, 0.15041)).toBe("15.01~15.04%");
    expect(formatShareRange(0.15, 0.15)).toBe("약 15%");
  });

  it("메인 문서의 '한국 가격의 A~B% 수준'은 A < B이고, 현재 시드에서는 14.5~15.4%다", () => {
    const why = stripTags(buildSections("/youtube-premium").find((s) => s.id === "home-why").html);
    const m = why.match(/한국 가격의 ([\d.]+)~([\d.]+)% 수준/);
    expect(m, why.slice(0, 200)).not.toBeNull();
    // 관계: 정렬된 2·3위라 아래 끝이 위 끝보다 작아야 한다(같으면 범위가 아니다)
    expect(Number(m[1])).toBeLessThan(Number(m[2]));
    // 리터럴 앵커: 시드가 바뀌면 여기가 먼저 red가 되어 문장을 다시 보게 한다
    expect(m[0]).toBe("한국 가격의 14.5~15.4% 수준");
  });

  it.each(TOOL_ROUTES)("%s 본문에 양 끝이 같은 범위(15~15% 같은)가 없다", (route) => {
    const collapsed = [...textOf(route).matchAll(RANGE)].filter((m) => m[1] === m[2]).map((m) => m[0]);
    expect(collapsed).toEqual([]);
  });
});

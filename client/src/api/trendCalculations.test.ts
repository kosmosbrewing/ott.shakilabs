import { describe, expect, it } from "vitest";
import { normalizePricesResponse } from "./priceTransforms";
import {
  buildCountryChanges,
  buildTimelineRows,
  buildTrendRows,
  buildTrendSummary,
  getPreviousSnapshot,
  type HistorySnapshot,
} from "./trendCalculations";
import type { PricesResponse } from "./types";

const basePriceData: PricesResponse = {
  baseCountry: "KR",
  lastUpdated: "2026-03-15",
  exchangeRateDate: "2026-03-14",
  prices: [
    {
      country: "한국",
      countryCode: "KR",
      currency: "KRW",
      plans: { individual: { monthly: 15000 } },
      converted: { individual: { krw: 15000, usd: 10.4 } },
    },
    {
      country: "터키",
      countryCode: "TR",
      currency: "TRY",
      plans: { individual: { monthly: 100 } },
      converted: { individual: { krw: 4500, usd: 3.1 } },
    },
    {
      countryCode: "US",
      currency: "USD",
      plans: { individual: { monthly: 10 } },
      converted: { individual: { krw: 11000, usd: 7.6 } },
    },
  ],
};

const snapshots: HistorySnapshot[] = [
  {
    date: "2026-03-01",
    prices: [
      { countryCode: "KR", krw: 16000 },
      { countryCode: "TR", krw: 5000 },
      { countryCode: "US", krw: 13000 },
    ],
  },
  {
    date: "2026-03-08",
    prices: [
      { countryCode: "KR", krw: 15500 },
      { countryCode: "TR", krw: 4800 },
      { countryCode: "US", krw: 12500 },
    ],
  },
];

describe("normalizePricesResponse", () => {
  it("잘못된 payload면 예외를 던진다", () => {
    expect(() => normalizePricesResponse({ prices: null })).toThrow("가격 데이터 형식이 올바르지 않습니다.");
  });

  it("KRW 요금제는 converted.krw를 보정한다", () => {
    const result = normalizePricesResponse({
      prices: [
        {
          countryCode: "KR",
          currency: "krw",
          plans: { individual: { monthly: 12900 } },
        },
      ],
    });

    expect(result.prices[0].converted?.individual?.krw).toBe(12900);
  });

  it("비 KRW 통화의 기존 환산값은 유지한다", () => {
    const result = normalizePricesResponse({
      prices: [
        {
          countryCode: "US",
          currency: "USD",
          plans: { individual: { monthly: 10 } },
          converted: { individual: { krw: 14000 } },
        },
      ],
    });

    expect(result.prices[0].converted?.individual?.krw).toBe(14000);
  });
});

describe("trendCalculations", () => {
  it("기준 국가 대비 절약률을 계산한다", () => {
    const rows = buildTrendRows(basePriceData);

    expect(rows.find((row) => row.countryCode === "TR")?.savingsPercent).toBe(70);
  });

  it("국가명이 없으면 국가 코드를 표시값으로 사용한다", () => {
    const rows = buildTrendRows(basePriceData);

    expect(rows.find((row) => row.countryCode === "US")?.country).toBe("US");
  });

  it("현재 날짜가 없으면 마지막 스냅샷을 이전값으로 사용한다", () => {
    expect(getPreviousSnapshot(snapshots, undefined)?.date).toBe("2026-03-08");
  });

  it("현재 날짜가 첫 스냅샷과 같으면 이전 스냅샷이 없다", () => {
    expect(getPreviousSnapshot(snapshots, "2026-03-01")).toBeNull();
  });

  it("현재 날짜가 스냅샷과 같으면 직전 스냅샷을 선택한다", () => {
    expect(getPreviousSnapshot(snapshots, "2026-03-08")?.date).toBe("2026-03-01");
  });

  it("국가별 변동 데이터는 최신 6개만 유지하고 현재 값을 보정한다", () => {
    const history = Array.from({ length: 7 }, (_, index) => ({
      date: `2026-03-0${index + 1}`,
      prices: [{ countryCode: "TR", krw: 4000 + index * 100 }],
    }));
    const rows = buildTrendRows(basePriceData);
    const changes = buildCountryChanges(rows, history, "2026-03-15");

    expect(changes.TR).toHaveLength(6);
    expect(changes.TR.at(-1)).toEqual({ date: "2026-03-15", krw: 4500 });
  });

  it("요약 데이터는 최저가, 절약률, 최대 하락 국가를 정렬해서 만든다", () => {
    const summary = buildTrendSummary(basePriceData, snapshots);

    expect(summary.cheapest?.[0]?.countryCode).toBe("TR");
    expect(summary.highestSavings?.[0]?.countryCode).toBe("TR");
    expect(summary.biggestDrops?.[0]?.countryCode).toBe("US");
    expect(summary.previousSnapshotDate).toBe("2026-03-08");
  });

  it("타임라인은 기준국을 맨 앞에 두고 나머지는 변동률 오름차순으로 정렬한다", () => {
    const rows = buildTrendRows(basePriceData);
    const changes = buildCountryChanges(rows, snapshots, "2026-03-15");
    const timeline = buildTimelineRows(rows, changes, "KR");

    expect(timeline[0]?.countryCode).toBe("KR");
    // KR: 15500 → 15000 = -3.2%
    expect(timeline[0]?.changePercent).toBe(-3.2);
    // 나머지: US(12500→11000, -12%) < TR(4800→4500, -6.2%)
    expect(timeline.slice(1).map((row) => row.countryCode)).toEqual(["US", "TR"]);
    expect(timeline[1]?.changePercent).toBe(-12);
    // 시계열은 스냅샷 2개 + 현재 시점까지 날짜순으로 담는다
    expect(timeline[0]?.points.map((p) => p.date)).toEqual([
      "2026-03-01",
      "2026-03-08",
      "2026-03-15",
    ]);
  });

  it("타임라인에서 방향별 상위 개수를 제한한다", () => {
    const priceData: PricesResponse = {
      baseCountry: "KR",
      lastUpdated: "2026-03-15",
      prices: ["KR", "AA", "BB", "CC", "DD"].map((code, index) => ({
        country: code,
        countryCode: code,
        currency: "USD",
        plans: { individual: { monthly: 10 } },
        converted: { individual: { krw: 10000 + index * 1000 } },
      })),
    };
    const history: HistorySnapshot[] = [
      {
        date: "2026-03-08",
        // AA/BB/CC/DD 모두 하락 (현재값이 스냅샷보다 낮음), KR은 동일
        prices: [
          { countryCode: "KR", krw: 10000 },
          { countryCode: "AA", krw: 20000 },
          { countryCode: "BB", krw: 20000 },
          { countryCode: "CC", krw: 20000 },
          { countryCode: "DD", krw: 20000 },
        ],
      },
    ];
    const rows = buildTrendRows(priceData);
    const changes = buildCountryChanges(rows, history, "2026-03-15");
    const timeline = buildTimelineRows(rows, changes, "KR", 2);

    // 기준국 1 + 하락 상위 2 (상승 국가 없음)
    expect(timeline).toHaveLength(3);
    expect(timeline[0]?.countryCode).toBe("KR");
    expect(timeline[0]?.changePercent).toBe(0);
  });
});

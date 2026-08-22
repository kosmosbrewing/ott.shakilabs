import { getNumber } from "./helpers";
import type { PricesResponse, TrendPoint, TrendRow, TrendTimelineRow, TrendsResponse } from "./types";

export type HistoryItem = {
  countryCode?: string;
  krw?: number;
};

export type HistorySnapshot = {
  date: string;
  prices: HistoryItem[];
};

export function buildTrendRows(priceData: PricesResponse): TrendRow[] {
  const baseCountry = priceData.prices.find((country) => country.countryCode === priceData.baseCountry);
  const baseKrw = getNumber(baseCountry?.converted?.individual?.krw);

  return priceData.prices.map((country) => {
    const currentKrw = getNumber(country.converted?.individual?.krw);
    const savingsPercent =
      baseKrw && currentKrw != null && baseKrw > 0
        ? Math.round(((baseKrw - currentKrw) / baseKrw) * 100)
        : 0;

    return {
      country: typeof country.country === "string" ? country.country : country.countryCode,
      countryCode: country.countryCode,
      continent: country.continent,
      currency: country.currency,
      localMonthly: getNumber(country.plans?.individual?.monthly) ?? undefined,
      usd: getNumber(country.converted?.individual?.usd) ?? undefined,
      krw: currentKrw ?? undefined,
      savingsPercent,
    };
  });
}

export function getPreviousSnapshot(
  snapshots: HistorySnapshot[],
  currentDate: string | undefined,
): HistorySnapshot | null {
  if (snapshots.length === 0) return null;
  if (!currentDate) return snapshots[snapshots.length - 1];

  const sameDateIndex = snapshots.findIndex((snapshot) => snapshot.date === currentDate);
  if (sameDateIndex > 0) return snapshots[sameDateIndex - 1];
  if (sameDateIndex === 0) return null;
  return snapshots[snapshots.length - 1];
}

export function buildCountryChanges(
  rows: TrendRow[],
  snapshots: HistorySnapshot[],
  currentDate: string | null,
): Record<string, TrendPoint[]> {
  const timelineByCountry: Record<string, TrendPoint[]> = Object.create(null);

  for (const snapshot of snapshots) {
    for (const item of snapshot.prices) {
      const countryCode = typeof item.countryCode === "string" ? item.countryCode.toUpperCase() : "";
      const krw = getNumber(item.krw);
      if (!countryCode || krw == null) continue;

      if (!timelineByCountry[countryCode]) {
        timelineByCountry[countryCode] = [];
      }

      timelineByCountry[countryCode].push({ date: snapshot.date, krw });
    }
  }

  for (const row of rows) {
    const code = row.countryCode.toUpperCase();
    const krw = getNumber(row.krw);
    if (!code || krw == null) continue;

    if (!timelineByCountry[code]) {
      timelineByCountry[code] = [];
    }

    const series = timelineByCountry[code];
    const hasCurrentDate = Boolean(currentDate) && series.some((item) => item.date === currentDate);

    if (currentDate && !hasCurrentDate) {
      series.push({ date: currentDate, krw });
    }

    series.sort((a, b) => a.date.localeCompare(b.date));
    timelineByCountry[code] = series.slice(-6);
  }

  return timelineByCountry;
}

// 기준국 + 직전 스냅샷 대비 변동 상위 국가(하락·상승 각 maxPerDirection개)를
// 수집 시점별 시계열과 함께 반환 — "trends" 페이지의 시점별 가격 표 데이터.
// 상승/하락을 섞어 뽑는 이유: 절대값 상위만 취하면 환율 방향에 따라 한쪽으로 쏠린다.
export function buildTimelineRows(
  rows: TrendRow[],
  countryChanges: Record<string, TrendPoint[]>,
  baseCountryCode = "KR",
  maxPerDirection = 5,
): TrendTimelineRow[] {
  const nameByCode = new Map<string, string>();
  for (const row of rows) {
    nameByCode.set(row.countryCode.toUpperCase(), row.country);
  }

  const candidates: TrendTimelineRow[] = [];
  let baseRow: TrendTimelineRow | null = null;

  for (const [code, points] of Object.entries(countryChanges)) {
    if (!Array.isArray(points) || points.length === 0) continue;

    const last = points[points.length - 1];
    const prev = points.length >= 2 ? points[points.length - 2] : null;
    const changePercent =
      prev && prev.krw > 0 ? Math.round(((last.krw - prev.krw) / prev.krw) * 1000) / 10 : null;

    const entry: TrendTimelineRow = {
      country: nameByCode.get(code) || code,
      countryCode: code,
      points,
      changePercent,
    };

    if (code === baseCountryCode.toUpperCase()) {
      baseRow = entry;
    } else if (changePercent != null) {
      candidates.push(entry);
    }
  }

  candidates.sort((a, b) => (a.changePercent ?? 0) - (b.changePercent ?? 0));
  const falls = candidates.filter((row) => (row.changePercent ?? 0) < 0).slice(0, maxPerDirection);
  const rises = candidates.filter((row) => (row.changePercent ?? 0) > 0).slice(-maxPerDirection);

  const selected = [...falls, ...rises];
  selected.sort((a, b) => (a.changePercent ?? 0) - (b.changePercent ?? 0));

  return baseRow ? [baseRow, ...selected] : selected;
}

export function buildTrendSummary(
  priceData: PricesResponse,
  snapshots: HistorySnapshot[],
): Omit<TrendsResponse, "serviceSlug"> {
  const rows = buildTrendRows(priceData);
  const previousSnapshot = getPreviousSnapshot(snapshots, priceData.lastUpdated);
  const previousMap = new Map<string, number>();

  for (const item of previousSnapshot?.prices ?? []) {
    const countryCode = typeof item.countryCode === "string" ? item.countryCode.toUpperCase() : "";
    const krw = getNumber(item.krw);
    if (!countryCode || krw == null) continue;
    previousMap.set(countryCode, krw);
  }

  const cheapest = rows
    .filter((row) => row.krw != null)
    .sort((a, b) => (a.krw ?? Infinity) - (b.krw ?? Infinity))
    .slice(0, 10);

  const highestSavings = rows
    .filter((row) => row.krw != null && (row.savingsPercent ?? 0) > 0)
    .sort((a, b) => (b.savingsPercent ?? 0) - (a.savingsPercent ?? 0))
    .slice(0, 10);

  const biggestDrops = rows
    .map((row): TrendRow | null => {
      const previousKrw = previousMap.get(row.countryCode.toUpperCase());
      const currentKrw = getNumber(row.krw);
      if (previousKrw == null || currentKrw == null) return null;

      const changeKrw = currentKrw - previousKrw;
      const changePercent = previousKrw > 0 ? Math.round((changeKrw / previousKrw) * 1000) / 10 : 0;

      return {
        country: row.country,
        countryCode: row.countryCode,
        previousDate: previousSnapshot?.date || null,
        previousKrw,
        currentKrw,
        changeKrw,
        changePercent,
      };
    })
    .filter((row): row is TrendRow => row !== null)
    .sort((a, b) => (a.changeKrw ?? 0) - (b.changeKrw ?? 0))
    .slice(0, 10);

  const countryChanges = buildCountryChanges(rows, snapshots, priceData.lastUpdated || null);

  // 관측 스냅샷이 하나도 없으면 시점 간 비교 자체가 성립하지 않는다.
  // 이 가드가 없으면 buildTimelineRows가 현재값 1점짜리 기준국 행(changePercent=null)을
  // 돌려주고, 화면에는 열이 하나뿐인 "시점별 비교표"가 남는다 — 비교한 적 없는 것을
  // 비교표 모양으로 보여주는 셈이다.
  const timeline =
    snapshots.length > 0 ? buildTimelineRows(rows, countryChanges, priceData.baseCountry || "KR") : [];

  return {
    asOf: priceData.lastUpdated || null,
    exchangeRateDate: priceData.exchangeRateDate || null,
    previousSnapshotDate: previousSnapshot?.date || null,
    cheapest,
    highestSavings,
    biggestDrops,
    countryChanges,
    timeline,
  };
}

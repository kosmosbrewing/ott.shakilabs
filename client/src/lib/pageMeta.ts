/**
 * 브라우저 쪽 페이지 메타 바인딩 — 제목·설명 문자열은 scripts/page-meta.mjs 하나가 만든다.
 *
 * 숫자(국가 수·조사일)는 프리렌더(seo-routes.mjs의 loadPriceSeed)와 같은 커밋 시드에서 꺼낸다.
 * API 응답으로 계산하면 로딩 전후로 제목이 바뀌고, 크롤러가 본 원시 HTML 제목과도 갈린다.
 */
import { homeMeta, serviceMeta, countryMeta } from "../../scripts/page-meta.mjs";
import priceSeed from "../../../data/prices/youtube-premium.json";

type SeedRow = {
  countryCode: string;
  country: string;
  currency?: string;
  plans?: { individual?: { monthly?: number } };
  converted?: { individual?: { krw?: number } };
};

const rows = priceSeed.prices as unknown as SeedRow[];
const countryCount = rows.length;

export const HOME_META = homeMeta({ countryCount });
export const SERVICE_META = serviceMeta({ countryCount, surveyDate: priceSeed.lastUpdated });

/** 국가 변형 메타 — 프리렌더(getCountryEntries)와 같은 원화 규칙(기준국 KRW는 현지 정가) */
export function countryPageMeta(countryCode: string) {
  const code = countryCode.toUpperCase();
  const row = rows.find((item) => item.countryCode.toUpperCase() === code);
  const isKrw = String(row?.currency || "").toUpperCase() === "KRW";
  const krw = isKrw ? row?.plans?.individual?.monthly : row?.converted?.individual?.krw;
  return countryMeta({
    country: row?.country || code,
    krw: Number.isFinite(krw) ? Math.round(krw as number) : null,
    isBaseCountry: code === String(priceSeed.baseCountry || "").toUpperCase(),
  });
}

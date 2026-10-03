/**
 * 요금 조사 출처 게이트 — "출처 없는 값"과 "조사일만 바꾼 값"을 막는다.
 *
 * data/prices/youtube-premium.json의 각 국가 행은 survey 블록을 갖는다.
 *  - verified: { 플랜: [공식 출처 URL, ...] } — 이번 회차에 공식 페이지로 확인한 값
 *  - unverified: [플랜, ...] — 공식 출처로 확인하지 못해 retainedFrom 회차의 값을 그대로 둔 칸
 *
 * 왜 필요한가: plans.*.monthly는 사람이 손으로 채우는 상수라(data/README.md) 값만 보고는
 * 어느 칸이 이번 조사에서 확인됐는지 알 수 없다. lastUpdated를 회차 날짜로 올리면서
 * 확인 못 한 칸을 구분하지 않으면, 하지 않은 확인을 했다고 주장하게 된다.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../../data/prices/youtube-premium.json"), "utf-8")
);

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

describe("요금 조사 출처 (survey)", () => {
  it("모든 국가 행이 이번 회차 날짜의 survey 블록을 갖는다", () => {
    for (const row of SEED.prices) {
      expect(row.survey, `${row.countryCode}: survey 없음`).toBeDefined();
      expect(row.survey.checkedAt, row.countryCode).toBe(SEED.lastUpdated);
      expect(Object.keys(STATUS_LABEL)).toContain(row.survey.status);
      expect(row.survey.label, row.countryCode).toBe(STATUS_LABEL[row.survey.status]);
    }
  });

  it("확인 칸과 미확인 칸이 요금제 칸을 빠짐없이, 겹치지 않게 나눈다", () => {
    for (const row of SEED.prices) {
      const plans = Object.keys(row.plans).sort();
      const verified = Object.keys(row.survey.verified ?? {});
      const unverified = row.survey.unverified ?? [];
      expect([...verified, ...unverified].sort(), row.countryCode).toEqual(plans);
      expect(verified.filter((p) => unverified.includes(p)), row.countryCode).toEqual([]);

      // 상태 이름이 실제 분할과 일치해야 한다
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

  it("미확인 칸은 값을 가져온 이전 회차 날짜를 밝힌다", () => {
    for (const row of SEED.prices) {
      const unverified = row.survey.unverified ?? [];
      if (unverified.length === 0) {
        expect(row.survey.retainedFrom, row.countryCode).toBeUndefined();
        continue;
      }
      expect(row.survey.retainedFrom, row.countryCode).toMatch(ISO_DATE);
      expect(row.survey.retainedFrom < SEED.lastUpdated, row.countryCode).toBe(true);
    }
  });

  it("값이 바뀐 칸의 환산값은 저장소 환율 규칙(fetch-exchange-rates.ts)과 일치한다", () => {
    // 규칙: usd = round(현지가 / 환율, 2) (USD는 그대로), krw = round(usd × krwRate)
    const rates = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../../data/exchange-rates.json"), "utf-8")
    ).rates;
    for (const row of SEED.prices) {
      const rate = row.currency === "USD" ? 1 : row.currency === "KRW" ? SEED.krwRate : rates[row.currency];
      if (!rate) continue; // 환율표에 없는 통화(GEL·BOB·DZD·MAD)는 이번 회차에 값이 바뀌지 않았다
      for (const plan of Object.keys(row.survey.verified ?? {})) {
        const usd = Math.round((row.plans[plan].monthly / rate) * 100) / 100;
        expect(row.converted[plan].usd, `${row.countryCode}.${plan}`).toBe(usd);
        expect(row.converted[plan].krw, `${row.countryCode}.${plan}`).toBe(Math.round(usd * SEED.krwRate));
      }
    }
  });
});

/**
 * 가격 데이터 로더 — 출처는 커밋된 시드 JSON 하나뿐이다.
 *
 * 왜 원격 API를 쓰지 않나: 예전에는 프리렌더가 `data/prices/*.json`을 읽어 정적 HTML을
 * 굽고, 브라우저는 하이드레이션 직후 백엔드 API 응답으로 그 값을 덮어썼다. 두 사본은
 * 서로 다른 날짜를 들고 있었고(시드 요금 조사일 2026-02-20 / API 2026-02-21, 환율도
 * 시드 스냅샷 vs 매일 갱신) 결과적으로 **같은 가격에 서로 다른 출처 날짜 두 쌍이 동시에
 * 공개**됐다. 게다가 환율이 다르니 원화 환산 순위까지 갈렸다 — 크롤러는 우크라이나를
 * ₩3,506·6위로, 사용자는 3,071원·5위로 봤다. 정적 산출물은 배포 이후의 환율을 알 수
 * 없으므로, 양쪽을 일치시키는 유일한 방법은 **런타임도 프리렌더와 같은 스냅샷을 읽는 것**이다.
 *
 * 그래서 이 모듈은 네트워크를 타지 않는다. 원화 값은 스냅샷 환율로 고정되고, 그 기준일은
 * 모든 화면에 '환율 기준일'로 명시된다(llms.txt와 같은 어법). 환율을 새로 반영하려면
 * `node scripts/fetch-exchange-rates.ts`를 돌려 시드를 갱신·커밋한다 —
 * 그러면 프리렌더와 화면이 같은 커밋에서 함께 움직인다.
 */
import youtubePremiumPriceSeed from "../../../data/prices/youtube-premium.json";
import { clone, ensureValidSlug } from "./helpers";
import { normalizePricesResponse } from "./priceTransforms";
import type { PricesResponse } from "./types";

// 발행 중인 서비스만 싣는다. data/README.md 기준으로 netflix·disney-plus·
// amazon-prime-video·spotify는 파생 합성값이라 발행 금지 상태다.
const PRICE_SEEDS: Record<string, unknown> = {
  "youtube-premium": youtubePremiumPriceSeed,
};

export function fetchPrices(serviceSlug: string): Promise<PricesResponse> {
  ensureValidSlug(serviceSlug);

  const seed = PRICE_SEEDS[serviceSlug];
  if (!seed) {
    return Promise.reject(new Error("아직 가격 데이터를 제공하지 않는 서비스입니다."));
  }

  return Promise.resolve(normalizePricesResponse(clone(seed)));
}

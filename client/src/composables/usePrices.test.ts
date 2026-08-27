import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPrices, type PricesResponse } from "@/api";
import { usePrices } from "./usePrices";

vi.mock("@/api", () => ({
  fetchPrices: vi.fn(),
}));

const mockedFetchPrices = vi.mocked(fetchPrices);

function pricePayload(source: string): PricesResponse {
  return {
    prices: [{ countryCode: "KR", currency: "KRW" }],
    lastUpdated: source,
  };
}

describe("usePrices", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockedFetchPrices.mockReset();
  });

  // 이 테스트가 지키는 것: 가격 출처는 하나뿐이다.
  // 예전에는 정적 스냅샷을 먼저 그린 뒤 원격 API 응답으로 덮어썼고, 두 사본의
  // 요금 조사일·환율 기준일이 달라 같은 화면이 서로 다른 출처 날짜 두 쌍을 노출했다.
  // 환율까지 달라 원화 환산 순위가 프리렌더와 라이브에서 뒤집혔다.
  it("커밋된 스냅샷 한 벌만 읽고 다른 값으로 덮어쓰지 않는다", async () => {
    mockedFetchPrices.mockResolvedValue(pricePayload("2026-02-20"));
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const prices = usePrices();
    await prices.loadPrices("youtube-premium");

    expect(prices.priceData.value?.lastUpdated).toBe("2026-02-20");
    expect(prices.error.value).toBeNull();
    expect(prices.loading.value).toBe(false);
    expect(mockedFetchPrices).toHaveBeenCalledTimes(1);
    // 네트워크 경로가 하나도 남아 있으면 안 된다 — 그 경로가 두 번째 출처였다.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("같은 slug를 두 번 부르면 캐시를 쓴다", async () => {
    mockedFetchPrices.mockResolvedValue(pricePayload("cached"));

    await usePrices().loadPrices("youtube-cache-check");
    const second = usePrices();
    await second.loadPrices("youtube-cache-check");

    expect(second.priceData.value?.lastUpdated).toBe("cached");
    expect(mockedFetchPrices).toHaveBeenCalledTimes(1);
  });

  it("시드를 제공하지 않는 slug는 에러 메시지로 끝난다", async () => {
    mockedFetchPrices.mockRejectedValue(new Error("아직 가격 데이터를 제공하지 않는 서비스입니다."));

    const prices = usePrices();
    await prices.loadPrices("youtube-missing-seed");

    expect(prices.priceData.value).toBeNull();
    expect(prices.error.value).toBe("아직 가격 데이터를 제공하지 않는 서비스입니다.");
    expect(prices.loading.value).toBe(false);
  });
});

import { ref, computed } from "vue";
import {
  fetchPrices,
  type CountryPrice,
  type PricesResponse,
} from "@/api";

export type SortOrder = "asc" | "desc";
export type DisplayCurrency = "krw" | "usd";

// 모듈 스코프 캐시 — 같은 slug를 여러 뷰가 동시에 요구할 때 중복 작업만 막는다.
const priceCache = new Map<string, PricesResponse>();

export function usePrices() {
  const priceData = ref<PricesResponse | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // 필터/정렬 상태
  const selectedPlan = ref<string>("individual");
  const sortOrder = ref<SortOrder>("asc"); // asc: 싼 순, desc: 비싼 순

  /**
   * 출처가 하나뿐이라 "먼저 정적 값을 그리고 나중에 API 값으로 덮어쓰는" 2단계가 없다.
   * 그 2단계가 바로 프리렌더와 화면의 순위·날짜가 갈리던 자리였다 —
   * 첫 페인트는 프리렌더와 같은 값, 이어서 다른 값. 이제 한 번만 읽는다.
   */
  async function loadPrices(serviceSlug: string): Promise<void> {
    const cached = priceCache.get(serviceSlug);
    if (cached) {
      priceData.value = cached;
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      const data = await fetchPrices(serviceSlug);
      priceCache.set(serviceSlug, data);
      priceData.value = data;
    } catch (loadError: unknown) {
      error.value = loadError instanceof Error
        ? loadError.message
        : "가격 정보를 불러오지 못했습니다.";
    } finally {
      loading.value = false;
    }
  }

  // 필터링 + 정렬된 가격 목록 (KRW 기준 정렬)
  const filteredPrices = computed<CountryPrice[]>(() => {
    if (!priceData.value?.prices) return [];

    const result = priceData.value.prices.filter(
      (p) => p.converted?.[selectedPlan.value] != null
    );

    result.sort((a, b) => {
      const priceA = a.converted?.[selectedPlan.value]?.krw ?? Infinity;
      const priceB = b.converted?.[selectedPlan.value]?.krw ?? Infinity;
      return sortOrder.value === "asc" ? priceA - priceB : priceB - priceA;
    });

    return result;
  });

  // 기준 국가 가격 (절약률 계산용)
  const baseCountryPrice = computed<CountryPrice | null>(() => {
    if (!priceData.value?.prices) return null;
    return priceData.value.prices.find(
      (p) => p.countryCode === priceData.value.baseCountry
    ) || null;
  });

  return {
    priceData,
    loading,
    error,
    selectedPlan,
    sortOrder,
    filteredPrices,
    baseCountryPrice,
    loadPrices,
  };
}

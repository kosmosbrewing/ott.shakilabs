import { ref, computed } from "vue";
import {
  fetchPrices,
  type CountryPrice,
  type PricesResponse,
} from "@/api";
import { ensureValidSlug } from "@/api/helpers";
import { normalizePricesResponse } from "@/api/priceTransforms";

export type SortOrder = "asc" | "desc";
export type DisplayCurrency = "krw" | "usd";

// 모듈 스코프 캐시 — slug별 가격 데이터 (하루 1회 갱신이므로 5분 TTL)
const CACHE_TTL_MS = 5 * 60 * 1000;
const STATIC_PRICE_TIMEOUT_MS = 5_000;

type CacheEntry = { data: PricesResponse; fetchedAt: number };
const priceCache = new Map<string, CacheEntry>();

function getCached(slug: string): PricesResponse | null {
  const entry = priceCache.get(slug);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    priceCache.delete(slug);
    return null;
  }
  return entry.data;
}

async function fetchStaticPrices(serviceSlug: string): Promise<PricesResponse> {
  ensureValidSlug(serviceSlug);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), STATIC_PRICE_TIMEOUT_MS);
  const baseUrl = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;

  try {
    const response = await fetch(`${baseUrl}data/prices/${serviceSlug}.json`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error("정적 가격 정보를 불러오지 못했습니다.");
    }
    return normalizePricesResponse(await response.json());
  } finally {
    clearTimeout(timeoutId);
  }
}

export function usePrices() {
  const priceData = ref<PricesResponse | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // 필터/정렬 상태
  const selectedPlan = ref<string>("individual");
  const sortOrder = ref<SortOrder>("asc"); // asc: 싼 순, desc: 비싼 순

  async function loadPrices(serviceSlug: string): Promise<void> {
    // 캐시 히트 시 네트워크 요청 생략
    const cached = getCached(serviceSlug);
    if (cached) {
      priceData.value = cached;
      return;
    }

    loading.value = true;
    error.value = null;

    const liveResultPromise = Promise.resolve()
      .then(() => fetchPrices(serviceSlug))
      .then((data) => ({ data, requestError: null }))
      .catch((requestError: unknown) => ({ data: null, requestError }));
    let hasStaticFallback = false;

    try {
      try {
        const staticData = await fetchStaticPrices(serviceSlug);
        priceCache.set(serviceSlug, { data: staticData, fetchedAt: Date.now() });
        priceData.value = staticData;
        hasStaticFallback = true;
        loading.value = false;
      } catch {
        // 정적 데이터가 없으면 기존 API 응답을 기다린다.
      }

      const { data, requestError } = await liveResultPromise;
      if (data) {
        priceCache.set(serviceSlug, { data, fetchedAt: Date.now() });
        priceData.value = data;
      } else if (!hasStaticFallback) {
        throw requestError;
      }
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

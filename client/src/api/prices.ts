import youtubePremiumPriceSeed from "../../../data/prices/youtube-premium.json";
import { API_BASE, clone, ensureValidSlug, extractApiErrorMessage } from "./helpers";
import { normalizePricesResponse } from "./priceTransforms";
import type { PricesResponse } from "./types";

const PRICE_API_TIMEOUT_MS = 15_000;

// 동일 slug 동시 요청 중복 방지 (API 레벨)
const inflightRequests = new Map<string, Promise<PricesResponse>>();

async function doFetch(serviceSlug: string): Promise<PricesResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PRICE_API_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}/prices/${serviceSlug}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(extractApiErrorMessage(payload) || "가격 정보를 불러오지 못했습니다.");
    }

    return normalizePricesResponse(payload);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("요청 시간이 초과되었습니다.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function fetchPrices(serviceSlug: string): Promise<PricesResponse> {
  ensureValidSlug(serviceSlug);

  const remotePricesEnabled = import.meta.env.PROD || import.meta.env.VITE_ENABLE_REMOTE_PRICES === "true";
  if (!remotePricesEnabled && serviceSlug === "youtube-premium") {
    return Promise.resolve(normalizePricesResponse(clone(youtubePremiumPriceSeed)));
  }

  const existing = inflightRequests.get(serviceSlug);
  if (existing) return existing;

  const promise = doFetch(serviceSlug).finally(() => {
    inflightRequests.delete(serviceSlug);
  });
  inflightRequests.set(serviceSlug, promise);

  return promise;
}

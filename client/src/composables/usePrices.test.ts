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

function staticResponse(payload: PricesResponse): Response {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue(payload),
  } as unknown as Response;
}

describe("usePrices", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockedFetchPrices.mockReset();
  });

  it("renders static prices before replacing them with live prices", async () => {
    let resolveLive!: (value: PricesResponse) => void;
    mockedFetchPrices.mockReturnValue(
      new Promise((resolve) => {
        resolveLive = resolve;
      }),
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(staticResponse(pricePayload("static"))));

    const prices = usePrices();
    const loadingPromise = prices.loadPrices("youtube-static-first");

    await vi.waitFor(() => expect(prices.priceData.value?.lastUpdated).toBe("static"));
    expect(prices.loading.value).toBe(false);

    resolveLive(pricePayload("live"));
    await loadingPromise;
    expect(prices.priceData.value?.lastUpdated).toBe("live");
  });

  it("uses the live API when static prices are unavailable", async () => {
    mockedFetchPrices.mockResolvedValue(pricePayload("live-only"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    const prices = usePrices();
    await prices.loadPrices("youtube-live-only");

    expect(prices.priceData.value?.lastUpdated).toBe("live-only");
    expect(prices.error.value).toBeNull();
  });

  it("keeps static prices when the live API fails", async () => {
    mockedFetchPrices.mockRejectedValue(new Error("API unavailable"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(staticResponse(pricePayload("fallback"))));

    const prices = usePrices();
    await prices.loadPrices("youtube-static-fallback");

    expect(prices.priceData.value?.lastUpdated).toBe("fallback");
    expect(prices.error.value).toBeNull();
  });
});

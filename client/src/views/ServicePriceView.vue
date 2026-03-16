<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { usePrices } from "@/composables/usePrices";
import { useServices } from "@/composables/useServices";
import { useSEO } from "@/composables/useSEO";
import { useHeadlineMessages } from "@/composables/useHeadlineMessages";
import { fetchTrends, type TrendsResponse, type CountryPrice } from "@/api";
import { formatNumber, countryFlag } from "@/lib/utils";
import { getSiteUrl } from "@/lib/site";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { LoadingSpinner } from "@/components/ui/loading";
import AdSlot from "@/components/layout/AdSlot.vue";
import PriceTable from "@/components/price/PriceTable.vue";
import PlanSelector from "@/components/filter/PlanSelector.vue";
import SortToggle from "@/components/filter/SortToggle.vue";
import AnonymousCommunityPanel from "@/components/community/AnonymousCommunityPanel.vue";
import CountryVoteModal from "@/components/community/CountryVoteModal.vue";
import PriceComparisonSection from "@/components/price/PriceComparisonSection.vue";
import ServiceSEOSection from "@/components/price/ServiceSEOSection.vue";
import { Vote } from "lucide-vue-next";
import { useMyPlan } from "@/composables/useMyPlan";

const route = useRoute();
const { services, loadServices } = useServices();
const {
  priceData,
  loading,
  error,
  selectedPlan,
  sortOrder,
  filteredPrices,
  loadPrices,
} = usePrices();
const { selectedPlan: myPlanId, hasChosen: myPlanChosen } = useMyPlan();

const { setMessages } = useHeadlineMessages();

const showTrendTop10 = false;
const trendData = ref<TrendsResponse | null>(null);
const trendLoading = ref(false);
const showVoteModal = ref(false);
const showAdPreview = import.meta.env.DEV;

// 투표 모달용 국가 목록: 가격 데이터에서 추출
const voteCountries = computed(() => {
  if (!priceData.value?.prices) return [];
  return priceData.value.prices
    .filter((p) => p.countryCode && p.country)
    .map((p) => ({
      countryCode: p.countryCode,
      country: typeof p.country === "string" ? p.country : p.countryCode,
    }));
});
const serviceSlug = computed(() => {
  const slug = route.params.serviceSlug;
  return typeof slug === "string" ? slug : "";
});

const currentService = computed(() =>
  services.value.find((s) => s.slug === serviceSlug.value)
);

const SEO_MAP: Record<string, { title: string; description: string }> = {
  "youtube-premium": {
    title: "유튜브 프리미엄 글로벌 가격 비교 · 나라별 구독료 최저가 순위",
    description:
      "유튜브 프리미엄(YouTube Premium) 국가별·나라별 구독료를 한눈에 비교. 최저가 국가 순위와 한국 대비 절약률. 현재 환율 기준 최신 데이터.",
  },
};

const serviceName = computed(() => currentService.value?.name || serviceSlug.value);
const loadingServiceName = computed(() => {
  if (currentService.value?.name) return currentService.value.name;
  if (serviceSlug.value === "youtube-premium") return "YouTube Premium";
  if (!serviceSlug.value) return "서비스";

  return serviceSlug.value
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
});
const loadingCompareTitle = computed(() => `${loadingServiceName.value} 글로벌 가격 비교`);
const loadingRankTitle = computed(() => `${loadingServiceName.value} 글로벌 랭킹`);

const pageTitle = computed(() =>
  SEO_MAP[serviceSlug.value]?.title ||
  `${serviceName.value} 글로벌 가격 비교 · 나라별 구독료 최저가 순위`
);

const pageDescription = computed(() =>
  SEO_MAP[serviceSlug.value]?.description ||
  `${serviceName.value} 국가별·나라별 구독 요금을 비교하고 최저가 국가와 절약률을 확인하세요. 현재 환율 기준.`
);

// ─── 가격 요약 (SEO JSON-LD + 헤드라인 메시지 공유) ─────────────────────────

type SummaryPriceRow = {
  countryCode: string;
  country: string;
  krw: number;
  usd: number | null;
};

type ComparePriceRow = {
  countryCode: string;
  country: string;
  currency: string | null;
  localMonthly: number | null;
  krw: number | null;
  usd: number | null;
};

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const siteUrl = getSiteUrl();

const summaryPriceRows = computed<SummaryPriceRow[]>(() => {
  if (!priceData.value?.prices) return [];
  return priceData.value.prices
    .map((country) => {
      const krw = toNumber(country.converted?.[selectedPlan.value]?.krw);
      if (krw == null) return null;
      const usd = toNumber(country.converted?.[selectedPlan.value]?.usd);
      return {
        countryCode: country.countryCode,
        country: typeof country.country === "string" ? country.country : country.countryCode,
        krw,
        usd,
      };
    })
    .filter((row): row is SummaryPriceRow => row !== null);
});

const cheapestSummary = computed<SummaryPriceRow | null>(() => {
  if (!summaryPriceRows.value.length) return null;
  return [...summaryPriceRows.value].sort((a, b) => a.krw - b.krw)[0] || null;
});

const baseCountrySummary = computed<SummaryPriceRow | null>(() => {
  const baseCountryCode = (priceData.value?.baseCountry || "").toUpperCase();
  if (!baseCountryCode) return null;
  return summaryPriceRows.value.find((c) => c.countryCode === baseCountryCode) || null;
});

const summarySavingsPercent = computed(() => {
  if (!cheapestSummary.value || !baseCountrySummary.value || baseCountrySummary.value.krw <= 0) return 0;
  return Math.max(
    0,
    Math.round(
      ((baseCountrySummary.value.krw - cheapestSummary.value.krw) / baseCountrySummary.value.krw) * 100
    )
  );
});

const selectedPlanLabel = computed(() => {
  const match = currentService.value?.plans?.find((plan) => plan.id === selectedPlan.value);
  return match?.name || selectedPlan.value;
});

// ─── 비교 카드에 전달할 데이터 ──────────────────────────────────────────────

const comparePriceRows = computed<ComparePriceRow[]>(() => {
  if (!priceData.value?.prices) return [];
  return priceData.value.prices
    .map((country) => {
      const plan = country.plans?.[selectedPlan.value];
      const converted = country.converted?.[selectedPlan.value];
      const code = String(country.countryCode || "").toUpperCase();
      if (!code) return null;
      return {
        countryCode: code,
        country: typeof country.country === "string" ? country.country : code,
        currency: typeof country.currency === "string" ? country.currency : null,
        localMonthly: toNumber(plan?.monthly),
        krw: toNumber(converted?.krw),
        usd: toNumber(converted?.usd),
      };
    })
    .filter((row): row is ComparePriceRow => row !== null);
});

// PriceComparisonSection이 expose하는 우측 기준 국가 코드 → 랭킹 테이블 기준
const comparisonRef = ref<InstanceType<typeof PriceComparisonSection> | null>(null);

const dynamicBaseCountryPrice = computed<CountryPrice | null>(() => {
  if (!priceData.value?.prices) return null;
  const rightCode = comparisonRef.value?.selectedRightCountryCode ?? "KR";
  return priceData.value.prices.find((p) => p.countryCode === rightCode) || null;
});

// ─── SEO JSON-LD ────────────────────────────────────────────────────────────

const itemListElements = computed<Record<string, unknown>[]>(() => {
  const base = baseCountrySummary.value;
  const baseCountryName = base?.country || "한국";
  const baseKrw = base?.krw || null;

  return [...summaryPriceRows.value]
    .sort((a, b) => a.krw - b.krw)
    .slice(0, 10)
    .map((row, index) => {
      const savingsPercent =
        baseKrw && baseKrw > 0
          ? Math.round(((baseKrw - row.krw) / baseKrw) * 100)
          : null;
      let description = `월 ${fmtKrw(row.krw)}`;
      if (savingsPercent != null) {
        if (savingsPercent > 0) {
          description = `월 ${fmtKrw(row.krw)} (${baseCountryName} 대비 ${savingsPercent}% 저렴)`;
        } else if (savingsPercent < 0) {
          description = `월 ${fmtKrw(row.krw)} (${baseCountryName} 대비 ${Math.abs(savingsPercent)}% 비쌈)`;
        } else {
          description = `월 ${fmtKrw(row.krw)} (${baseCountryName}와 동일)`;
        }
      }
      return { "@type": "ListItem", position: index + 1, name: row.country, description };
    });
});

// ServiceSEOSection이 expose하는 faqItems → JSON-LD 스냅샷
const seoSectionRef = ref<InstanceType<typeof ServiceSEOSection> | null>(null);
const seoFaqSnapshot = ref<{ q: string; a: string }[]>([]);

watch(
  () => seoSectionRef.value?.faqItems,
  (items) => {
    if (items && items.length > 0 && seoFaqSnapshot.value.length === 0) {
      seoFaqSnapshot.value = [...items];
    }
  },
  { immediate: true }
);

const seoJsonLd = computed<Record<string, unknown> | undefined>(() => {
  if (!seoFaqSnapshot.value.length) return undefined;
  const currentServiceName = serviceName.value;

  const graph: Record<string, unknown>[] = [
    {
      "@type": "FAQPage",
      mainEntity: seoFaqSnapshot.value.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
    {
      "@type": "Dataset",
      name: `${currentServiceName} 국가별 구독 가격 데이터`,
      description: `${currentServiceName} ${selectedPlanLabel.value} 요금제의 국가별 월 구독료를 현지 통화, 한국 원(KRW), 미국 달러(USD)로 환산하여 비교할 수 있는 데이터셋입니다. 전 세계 주요 국가의 최신 가격 정보를 포함합니다.`,
      url: `${siteUrl}/${serviceSlug.value}`,
      dateModified: priceData.value?.lastUpdated || undefined,
      variableMeasured: ["월 구독료 (현지 통화)", "월 구독료 (KRW)", "월 구독료 (USD)"],
      creator: {
        "@type": "Organization",
        name: "ShakiLabs",
        url: "https://shakilabs.com",
      },
      license: "https://creativecommons.org/licenses/by-nc/4.0/",
    },
  ];

  if (itemListElements.value.length > 0) {
    graph.push({
      "@type": "ItemList",
      name: `${currentServiceName} ${selectedPlanLabel.value} 국가별 가격 순위`,
      itemListElement: itemListElements.value,
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
});

useSEO({
  title: pageTitle,
  description: pageDescription,
  ogImage: `${siteUrl}/og/v2/youtube-premium.png`,
  jsonLd: seoJsonLd,
});

// ─── 포맷 유틸 ──────────────────────────────────────────────────────────────

function fmtKrw(val: number | null | undefined): string {
  if (val == null) return "-";
  return `${formatNumber(Math.round(val))}원`;
}

function fmtUsd(val: number | null | undefined): string {
  if (val == null) return "-";
  return `$${val.toFixed(2)}`;
}

function fmtDeltaKrw(value: number | null | undefined): string {
  if (value == null) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value)}원`;
}

const usdToKrwRate = computed<number | null>(() => priceData.value?.krwRate ?? null);

// ─── 헤드라인 메시지 (환율 변동 시 자동 갱신) ───────────────────────────────

watch(
  [summaryPriceRows, baseCountrySummary, serviceName, priceData],
  ([rows, base, name, data]) => {
    if (!rows.length || !name) return;

    const sorted = [...rows].sort((a, b) => a.krw - b.krw);
    const [cheapest, second, third] = sorted;
    const mostExpensive = sorted[sorted.length - 1];
    const baseKrw = base?.krw ?? null;

    const savings =
      cheapest && baseKrw && baseKrw > 0
        ? Math.round(((baseKrw - cheapest.krw) / baseKrw) * 100)
        : 0;
    const savingsAmt = cheapest && baseKrw ? Math.round(baseKrw - cheapest.krw) : 0;
    const cups = Math.floor(savingsAmt / 5000);
    const underKorea = baseKrw != null ? rows.filter((r) => r.krw < baseKrw).length : 0;

    const baseEntry = data?.prices.find(
      (p) => p.countryCode.toUpperCase() === (data.baseCountry ?? "").toUpperCase()
    );
    const liteKrw = toNumber(baseEntry?.converted?.["lite"]?.krw);

    const msgs: string[] = [];
    if (cheapest) msgs.push(`최저가 🥇 ${cheapest.country} — 월 ${fmtKrw(cheapest.krw)}`);
    if (savings > 0 && cheapest) msgs.push(`한국 ${fmtKrw(baseKrw!)} vs ${cheapest.country} ${fmtKrw(cheapest.krw)} — ${savings}% 차이 🫠`);
    if (mostExpensive && mostExpensive.countryCode !== cheapest?.countryCode && baseKrw != null && mostExpensive.krw > baseKrw) {
      msgs.push(`${countryFlag(mostExpensive.countryCode)} ${mostExpensive.country}는 월 ${fmtKrw(mostExpensive.krw)}. 한국이 저렴해 보이는 순간 😅`);
    }
    if (savingsAmt > 0) msgs.push(`최저가로 바꾸면 매달 ${fmtKrw(savingsAmt)} 절약`);
    if (second) msgs.push(`🥈 ${second.country} — 월 ${fmtKrw(second.krw)}`);
    if (savings > 0) msgs.push(`최대 ${savings}% 저렴, 월 ${fmtKrw(savingsAmt)} 아끼는 나라가 있어요`);
    if (cups >= 2) msgs.push(`절약액 = 커피 ${cups}잔 ☕ 매달 공짜`);
    if (third) msgs.push(`🥉 ${third.country} — 월 ${fmtKrw(third.krw)}`);
    if (savingsAmt > 0) {
      const yearSavings = savingsAmt * 12;
      const chickens = Math.floor(yearSavings / 22000);
      msgs.push(chickens > 0 ? `1년이면 ${fmtKrw(yearSavings)} 차이. 치킨 ${chickens}마리값 🍗` : `1년이면 ${fmtKrw(yearSavings)} 차이`);
    }
    if (liteKrw != null) msgs.push(`프리미엄 라이트 월 ${fmtKrw(Math.round(liteKrw))} — 유튜브 뮤직 빼면 이 가격 🎵`);
    if (cheapest?.usd != null) msgs.push(`${cheapest.country} 달러 기준 ${fmtUsd(cheapest.usd)}/월`);
    if (underKorea > 0) msgs.push(`${underKorea}개국이 한국보다 저렴합니다`);

    setMessages(msgs);
  },
  { immediate: true }
);

// ─── 트렌드 ─────────────────────────────────────────────────────────────────

async function loadTrendData(service: string): Promise<void> {
  trendLoading.value = true;
  try {
    trendData.value = await fetchTrends(service);
  } catch {
    trendData.value = null;
  } finally {
    trendLoading.value = false;
  }
}

// ─── 초기화 + 라우트 변경 ───────────────────────────────────────────────────

async function init(): Promise<void> {
  if (!serviceSlug.value) return;
  const tasks: Array<Promise<void>> = [loadServices(), loadPrices(serviceSlug.value)];
  if (showTrendTop10) tasks.push(loadTrendData(serviceSlug.value));
  await Promise.all(tasks);
}

onMounted(init);

// useMyPlan hydration/저장 시점에 요금제 동기화 (App.vue onMounted 이후에도 반영)
watch(
  [myPlanChosen, myPlanId],
  ([chosen, planId]) => {
    if (chosen && planId) {
      selectedPlan.value = planId;
    }
  },
  { immediate: true }
);

watch(serviceSlug, async (slug) => {
  if (!slug) return;
  try {
    await loadPrices(slug);
  } catch {
    // usePrices 내부에서 error ref로 처리됨
  }
});
</script>

<template>
  <div class="container py-6">
    <!-- 로딩 -->
    <div
      v-if="loading || (!priceData && !error)"
      class="third-rate-board space-y-4 animate-pulse min-h-[1100px]"
      aria-busy="true"
      aria-live="polite"
    >
      <Card class="retro-panel overflow-hidden">
        <div class="retro-titlebar">
          <h2 class="retro-title">{{ loadingCompareTitle }}</h2>
        </div>
        <CardContent class="grid gap-3 md:grid-cols-[minmax(0,1fr)_56px_minmax(0,1fr)] md:items-stretch">
          <div class="h-[180px] rounded bg-muted/70" />
          <div class="hidden h-[180px] rounded bg-muted/70 md:block" />
          <div class="h-[180px] rounded bg-muted/70" />
        </CardContent>
      </Card>

      <Card class="retro-panel overflow-hidden">
        <CardContent class="h-20" />
      </Card>

      <section class="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_340px]">
        <div class="space-y-4">
          <Card class="retro-panel overflow-hidden">
            <div class="retro-titlebar">
              <h2 class="retro-title">{{ loadingRankTitle }}</h2>
            </div>
            <CardContent class="space-y-2">
              <div
                v-for="i in 10"
                :key="`loading-rank-${i}`"
                class="h-10 rounded bg-muted/70"
              />
            </CardContent>
          </Card>

          <Card class="retro-panel overflow-hidden">
            <div class="retro-titlebar">
              <h2 class="retro-title">자주 묻는 질문</h2>
            </div>
            <CardContent class="space-y-2">
              <div
                v-for="i in 4"
                :key="`loading-faq-${i}`"
                class="h-11 rounded bg-muted/70"
              />
            </CardContent>
          </Card>
        </div>

        <aside class="space-y-4">
          <div class="retro-panel overflow-hidden">
            <div class="retro-panel-content h-[220px] rounded bg-muted/70" />
          </div>
          <div class="retro-panel overflow-hidden">
            <div class="retro-panel-content h-[160px] rounded bg-muted/70" />
          </div>
        </aside>
      </section>
    </div>

    <!-- 에러 -->
    <div v-else-if="error" class="text-center py-20">
      <p class="text-destructive text-body">{{ error }}</p>
    </div>

    <!-- 가격 데이터 -->
    <div v-else-if="priceData" class="third-rate-board">
      <!-- SEO h1 — 시각적 숨김, 크롤러 인식 -->
      <h1 class="sr-only">YouTube Premium 글로벌 가격 비교 — 나라별 구독료 최저가 순위</h1>

      <!-- VS 비교 + 공유 -->
      <PriceComparisonSection
        ref="comparisonRef"
        :price-data="priceData"
        :selected-plan="selectedPlan"
        :selected-plan-label="selectedPlanLabel"
        :service-name="serviceName"
        :service-slug="serviceSlug"
        :compare-price-rows="comparePriceRows"
      />

      <AdSlot position="top" :preview="showAdPreview" />

      <!-- 필터 영역 -->
      <Card class="mb-4 retro-panel">
        <CardContent class="space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <PlanSelector
              v-if="currentService"
              :plans="currentService.plans"
              v-model="selectedPlan"
            />
            <div class="flex items-center gap-2">
              <SortToggle v-model="sortOrder" />
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- 가격 테이블 + 익명 커뮤니티 -->
      <section class="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_340px]">
        <div class="space-y-4">
          <Card id="ranking" class="retro-panel overflow-hidden">
            <div class="retro-titlebar">
              <h2 class="retro-title">YouTube Premium 글로벌 랭킹</h2>
            </div>
            <CardContent>
              <PriceTable
                :prices="filteredPrices"
                :selected-plan="selectedPlan"
                :sort-order="sortOrder"
                :base-country-price="dynamicBaseCountryPrice"
                :service-slug="serviceSlug"
              />
              <div class="mt-2 flex flex-wrap items-center justify-end gap-2 text-[0.72rem] font-normal text-muted-foreground leading-tight">
                <span>총 {{ filteredPrices.length }}개국</span>
                <span>· 업데이트 {{ priceData.lastUpdated }}</span>
                <span>· 환율 기준 {{ priceData.exchangeRateDate }}</span>
                <span v-if="usdToKrwRate">· $1 = ₩{{ formatNumber(usdToKrwRate) }}</span>
              </div>
            </CardContent>
          </Card>

          <!-- 트렌드 TOP 10 (비활성) -->
          <Card v-if="showTrendTop10" class="retro-panel overflow-hidden">
            <div class="retro-titlebar">
              <h2 class="retro-title">최근 가격 변동 TOP 10</h2>
              <RouterLink :to="`/${serviceSlug}/trends`" class="retro-kbd hover:bg-primary-foreground/25">
                MORE
              </RouterLink>
            </div>
            <CardContent>
              <LoadingSpinner v-if="trendLoading" variant="dots" size="sm" :center="false" />
              <div v-else-if="trendData?.biggestDrops?.length">
                <Table>
                  <TableHeader class="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead class="text-body text-muted-foreground">국가</TableHead>
                      <TableHead class="text-body text-muted-foreground text-right">이전</TableHead>
                      <TableHead class="text-body text-muted-foreground text-right">현재</TableHead>
                      <TableHead class="text-body text-muted-foreground text-right">변동</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow v-for="item in trendData.biggestDrops" :key="item.countryCode">
                      <TableCell>
                        <RouterLink
                          :to="`/${serviceSlug}/${item.countryCode.toLowerCase()}`"
                          class="inline-flex items-center gap-2 hover:text-primary transition-colors font-semibold"
                        >
                          <span class="text-body">{{ countryFlag(item.countryCode) }}</span>
                          <span class="text-body">{{ item.country }}</span>
                        </RouterLink>
                      </TableCell>
                      <TableCell class="text-caption text-muted-foreground text-right tabular-nums">{{ fmtKrw(item.previousKrw) }}</TableCell>
                      <TableCell class="font-semibold text-body text-foreground text-right tabular-nums">{{ fmtKrw(item.currentKrw) }}</TableCell>
                      <TableCell
                        class="text-body text-right tabular-nums"
                        :class="item.changeKrw < 0 ? 'text-savings' : 'text-destructive'"
                      >
                        {{ fmtDeltaKrw(item.changeKrw) }}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <div v-else class="text-caption text-muted-foreground">
                비교할 변동 데이터가 없습니다.
              </div>
            </CardContent>
          </Card>
        </div>

        <aside class="space-y-4">
          <div class="retro-panel overflow-hidden">
            <div class="retro-panel-content">
              <AdSlot position="sidebar" :preview="showAdPreview" />
            </div>
          </div>

          <!-- 국가 투표 카드 -->
          <div class="retro-panel overflow-hidden">
            <div class="retro-panel-content">
              <button
                type="button"
                class="w-full flex items-center gap-2.5 rounded-sm border border-primary/30 bg-primary/5 px-3 py-2.5 text-left transition-colors hover:border-primary/60 hover:bg-primary/10"
                @click="showVoteModal = true"
              >
                <Vote class="h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p class="!text-xs font-bold text-foreground">YouTube Premium 최적 국가 투표</p>
                  <p class="!text-[11px] text-muted-foreground">어떤 나라에서 구독하는 게 가장 좋을까요?</p>
                </div>
              </button>
            </div>
          </div>

          <AnonymousCommunityPanel :service-slug="serviceSlug" />
        </aside>
      </section>

      <!-- 국가 투표 모달 -->
      <CountryVoteModal
        :show="showVoteModal"
        :service-slug="serviceSlug"
        :countries="voteCountries"
        @close="showVoteModal = false"
      />

      <!-- FAQ -->
      <ServiceSEOSection
        ref="seoSectionRef"
        :service-slug="serviceSlug"
        :service-name="serviceName"
        :selected-plan-label="selectedPlanLabel"
        :cheapest-country="cheapestSummary?.country ?? null"
        :cheapest-krw="cheapestSummary?.krw ?? null"
        :cheapest-usd="cheapestSummary?.usd ?? null"
        :base-country-name="baseCountrySummary?.country ?? '한국'"
        :base-krw="baseCountrySummary?.krw ?? null"
        :base-usd="baseCountrySummary?.usd ?? null"
        :savings-percent="summarySavingsPercent"
        :exchange-rate-date="priceData.exchangeRateDate || '최근 기준일'"
        :last-updated="priceData.lastUpdated || '최근 업데이트'"
        :base-country-code="(priceData.baseCountry || '').toUpperCase()"
      />
    </div>
  </div>
</template>

<style scoped>
.third-rate-board :deep(.retro-title) {
  font-size: clamp(1.25rem, 2.6vw, 2rem);
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: none;
  text-shadow: 1px 1px 0 rgb(203 213 225 / 0.9);
}

.third-rate-board :deep(.retro-kbd) {
  font-size: clamp(0.9rem, 1.4vw, 1.1rem);
  font-weight: 800;
  letter-spacing: 0.05em;
}

.third-rate-board :deep(.text-body) {
  font-size: clamp(1rem, 1.65vw, 1.24rem);
  font-weight: 700;
}

.third-rate-board :deep(.text-caption) {
  font-size: clamp(0.9rem, 1.3vw, 1.05rem);
  font-weight: 700;
}

.third-rate-board :deep(.text-tiny) {
  font-size: clamp(0.84rem, 1.08vw, 0.96rem);
  font-weight: 700;
}

.third-rate-board :deep(th) {
  font-size: clamp(0.9rem, 1.3vw, 1.05rem);
  font-weight: 800;
}

.third-rate-board :deep(td) {
  font-size: clamp(0.9rem, 1.2vw, 1rem);
  font-weight: 650;
}
</style>

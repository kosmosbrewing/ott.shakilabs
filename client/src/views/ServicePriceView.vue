<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { usePrices } from "@/composables/usePrices";
import { useServices } from "@/composables/useServices";
import { useSEO } from "@/composables/useSEO";
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
import SeoRichContent from "@/components/seo/SeoRichContent.vue";
import { getSurveyProvenance } from "@/lib/seoContent";
import RelatedServices from "@/components/common/RelatedServices.vue";
import { Vote } from "lucide-vue-next";
import { useMyPlan } from "@/composables/useMyPlan";
import CalculatorInteractionTracker from "@/components/analytics/CalculatorInteractionTracker.vue";
import { COMMUNITY_ENABLED } from "@/lib/features";
import { SERVICE_META } from "@/lib/pageMeta";

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

const showTrendTop10 = false;
const trendData = ref<TrendsResponse | null>(null);
const trendLoading = ref(false);
const showVoteModal = ref(false);
const showAdPreview = import.meta.env.DEV;
// 사이드바 광고 슬롯이 설정되지 않은 빌드에서 커뮤니티·투표까지 끄면 오른쪽 340px 칸에
// 빈 상자 하나만 남는다. 그때는 칸을 접어 순위표가 폭을 쓰게 한다(AdSlot.vue와 같은 판정).
const sidebarAdConfigured = Boolean(
  (import.meta.env.VITE_ADSENSE_PUBLISHER_ID || "").trim() &&
    (import.meta.env.VITE_ADSENSE_SLOT_SIDEBAR || "").trim()
);
const showSidebar = COMMUNITY_ENABLED || sidebarAdConfigured || showAdPreview;

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

// 요금 조사 문장 — 전수 조사일과 공식 출처 재확인일을 국가 행의 survey 블록에서 세어 만든다.
// 재확인하지 못한 값에 재확인 날짜가 붙지 않도록, 날짜 하나(lastUpdated)로 줄여 쓰지 않는다.
// 시드가 youtube-premium 하나뿐이라 그 서비스에서만 쓴다.
const surveySentence = computed(() =>
  serviceSlug.value === "youtube-premium" ? getSurveyProvenance() : null
);

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

// 제목·설명은 프리렌더(scripts/prerender.mjs)와 같은 함수(scripts/page-meta.mjs)에서 나온다.
// 라우터가 받는 서비스 슬러그는 활성 서비스(유튜브 프리미엄) 하나뿐이다.
const pageTitle = SERVICE_META.title;
const pageDescription = SERVICE_META.description;

// ─── 가격 요약 (SEO JSON-LD + FAQ 공유) ─────────────────────────────────────

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
      // 정가는 사람이 조사해 반영하므로 "최신"이라 단언하지 않는다. dateModified는 전수 조사일이고,
      // 일부 칸만 다시 확인한 재확인일은 description의 요금 조사 문장에만 범위와 함께 적는다.
      description: `${currentServiceName} ${selectedPlanLabel.value} 요금제의 국가별 월 구독료를 현지 통화, 한국 원(KRW), 미국 달러(USD)로 환산하여 비교할 수 있는 데이터셋입니다. 사람이 조사해 반영한 정가이며, 요금 조사 시점: ${surveySentence.value ?? priceData.value?.lastUpdated ?? "-"}.`,
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

function fmtDeltaKrw(value: number | null | undefined): string {
  if (value == null) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value)}원`;
}

const usdToKrwRate = computed<number | null>(() => priceData.value?.krwRate ?? null);

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
  <div class="text-resize-layout container py-6">
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
      <h1 class="sr-only">유튜브 프리미엄 국가별 요금 비교 — 원화 환산 순위</h1>

      <!-- VS 비교 + 공유 -->
      <CalculatorInteractionTracker
        calculator-id="youtube_premium_compare"
        :page-path="'/ott/' + serviceSlug"
      >
        <PriceComparisonSection
          ref="comparisonRef"
          :price-data="priceData"
          :selected-plan="selectedPlan"
          :selected-plan-label="selectedPlanLabel"
          :service-name="serviceName"
          :service-slug="serviceSlug"
          :compare-price-rows="comparePriceRows"
        />
      </CalculatorInteractionTracker>

      <AdSlot position="top" :preview="showAdPreview" />

      <!-- 필터 영역 -->
      <Card class="mb-4 retro-panel">
        <CardContent class="space-y-4">
          <CalculatorInteractionTracker
            calculator-id="youtube_premium_filter"
            :page-path="'/ott/' + serviceSlug"
          >
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
          </CalculatorInteractionTracker>
        </CardContent>
      </Card>

      <!-- 가격 테이블 (+ 사이드바: 광고·커뮤니티가 있을 때만) -->
      <section
        class="grid grid-cols-1 gap-4"
        :class="showSidebar ? 'lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_340px]' : ''"
      >
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
              <div class="mt-2 flex flex-wrap items-center justify-end gap-2 text-caption font-normal text-muted-foreground leading-tight">
                <span>총 {{ filteredPrices.length }}개국</span>
                <span v-if="surveySentence" data-survey-provenance>· 요금 조사: {{ surveySentence }}</span>
                <span v-else>· 요금 조사 {{ priceData.lastUpdated }}</span>
                <span>· 환율 기준 {{ priceData.exchangeRateDate }}</span>
                <span v-if="usdToKrwRate">· $1 = ₩{{ formatNumber(usdToKrwRate) }}</span>
              </div>
              <!-- 약관·현지 결제 조건을 순위표 바로 아래에 둔다. 예전에는 페이지 맨 아래 해설과
                   접힌 FAQ 안에만 있어, 순위만 보고 나가는 사람은 볼 수 없었다. -->
              <p
                role="note"
                class="mt-3 rounded-sm border border-border bg-muted/40 px-3 py-2 text-sm leading-relaxed text-foreground"
              >
                <strong>요금은 각 나라의 정가이며, 해외 요금으로 가입하는 방법을 안내하는 표가 아닙니다.</strong>
                요금은 접속 위치가 아니라 결제 수단 발행 국가와 계정 청구 국가로 정해지고, YouTube 약관은
                실제 거주 국가의 요금을 내도록 요구합니다. VPN·해외 주소로 가입하면 결제가 거부되거나 구독이 취소될 수 있습니다.
              </p>
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
                  <caption class="sr-only">최근 국가별 구독 요금 변동</caption>
                  <TableHeader class="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead scope="col" class="text-body text-muted-foreground">국가</TableHead>
                      <TableHead scope="col" class="text-body text-muted-foreground text-right">이전</TableHead>
                      <TableHead scope="col" class="text-body text-muted-foreground text-right">현재</TableHead>
                      <TableHead scope="col" class="text-body text-muted-foreground text-right">변동</TableHead>
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

        <aside v-if="showSidebar" class="space-y-4">
          <div v-if="sidebarAdConfigured || showAdPreview" class="retro-panel overflow-hidden">
            <div class="retro-panel-content">
              <AdSlot position="sidebar" :preview="showAdPreview" />
            </div>
          </div>

          <!-- 국가 투표 카드 — 커뮤니티 백엔드가 있을 때만 -->
          <div v-if="COMMUNITY_ENABLED" class="retro-panel overflow-hidden">
            <div class="retro-panel-content">
              <button
                type="button"
                class="w-full flex items-center gap-2.5 rounded-sm border border-primary/30 bg-primary/5 px-3 py-2.5 text-left transition-colors hover:border-primary/60 hover:bg-primary/10"
                @click="showVoteModal = true"
              >
                <Vote class="h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p class="!text-xs font-bold text-foreground">YouTube Premium 국가별 요금 비교</p>
                  <p class="text-caption text-muted-foreground">요금 수준이 가장 합리적으로 보이는 나라는 어디인가요?</p>
                </div>
              </button>
            </div>
          </div>

          <AnonymousCommunityPanel v-if="COMMUNITY_ENABLED" :service-slug="serviceSlug" />
        </aside>
      </section>

      <!-- 국가 투표 모달 -->
      <CountryVoteModal
        v-if="COMMUNITY_ENABLED"
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
        :survey-summary="surveySentence || `요금 조사일 ${priceData.lastUpdated || '-'}`"
        :base-country-code="(priceData.baseCountry || '').toUpperCase()"
      />

      <RelatedServices />
    </div>

    <!--
      프리렌더에만 있던 해설(국가별 가격 차이가 생기는 이유·주요 기능·약관 주의·관련 페이지)을
      화면에도 렌더한다. 라이브 가격표와 FAQ는 seo-content.mjs에서 live:true로 표시돼 제외된다.
      조건 분기 바깥에 두는 이유는 API가 죽어도 이 문구는 보여야 하기 때문이다.
    -->
    <div class="retro-panel retro-panel-content mt-4 overflow-hidden border border-border/40">
      <SeoRichContent :route="`/${serviceSlug}`" embedded />
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

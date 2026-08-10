<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { fetchTrends, type TrendRow, type TrendTimelineRow, type TrendsResponse } from "@/api";
import { useServices } from "@/composables/useServices";
import { useSEO } from "@/composables/useSEO";
import { formatNumber, countryFlag } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { LoadingSpinner } from "@/components/ui/loading";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import SeoRichContent from "@/components/seo/SeoRichContent.vue";
import changelogSeed from "../../../data/reports/changelog.json";

type ChangelogEntry = {
  id: string;
  serviceSlug?: string;
  countryCode?: string;
  planId?: string;
  previousKrw?: number;
  currentKrw?: number;
  deltaKrw?: number;
  note?: string;
  updatedAt?: string;
};

const route = useRoute();
const { services, loadServices } = useServices();
const serviceSlug = computed(() => {
  const slug = route.params.serviceSlug;
  return typeof slug === "string" ? slug : "";
});

const trends = ref<TrendsResponse | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const currentService = computed(() =>
  services.value.find((service) => service.slug === serviceSlug.value)
);

const trendHeading = computed(() => {
  if (serviceSlug.value === "youtube-premium") {
    return "YouTube Premium 가격 트렌드";
  }
  return `${currentService.value?.name || serviceSlug.value} 가격 트렌드`;
});

const pageTitle = computed(() => {
  const serviceName = currentService.value?.name || serviceSlug.value;
  return `${serviceName} 가격 변동 트렌드 · 국가별 구독료 변화 | OTT 가격 비교`;
});

const pageDescription = computed(() => {
  const serviceName = currentService.value?.name || serviceSlug.value;
  return `${serviceName} 국가별 구독료를 수집 시점별 스냅샷으로 비교. 최저가·절약률 순위와 원화 환산 가격 변동의 환율 영향 해석. 실시간 시세가 아닌 시점별 데이터 기준.`;
});

// ─── 수집 시점별 타임라인 ────────────────────────────────────────────────────
const timelineRows = computed<TrendTimelineRow[]>(() => trends.value?.timeline ?? []);

const timelineDates = computed<string[]>(() => {
  const seen = new Set<string>();
  for (const row of timelineRows.value) {
    for (const point of row.points) seen.add(point.date);
  }
  return [...seen].sort();
});

function timelineKrwAt(row: TrendTimelineRow, date: string): number | null {
  const point = row.points.find((p) => p.date === date);
  return point ? point.krw : null;
}

// ─── 데이터 갱신·보정 기록 (수집 데이터 보정 이력 — 공식 요금 공지가 아님) ──
const regionNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["ko"], { type: "region" })
    : null;

function changelogCountryName(code: string | undefined): string {
  if (!code) return "-";
  try {
    return regionNames?.of(code.toUpperCase()) || code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

const changelogEntries = computed<ChangelogEntry[]>(() => {
  const updates = Array.isArray(changelogSeed.updates)
    ? (changelogSeed.updates as ChangelogEntry[])
    : [];
  return updates
    .filter((entry) => !entry.serviceSlug || entry.serviceSlug === serviceSlug.value)
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
});

// ─── FAQ (화면 텍스트 = FAQPage 스키마 텍스트 동일 소스) ─────────────────────
const faqItems = computed<{ q: string; a: string }[]>(() => {
  if (!trends.value) return [];
  const fxDate = trends.value.exchangeRateDate || trends.value.asOf || "-";
  const dates = timelineDates.value.length > 0 ? timelineDates.value.join(" · ") : "-";

  return [
    {
      q: "이 페이지의 가격 변동은 실제 요금 인상·인하인가요?",
      a: "반드시 그렇지는 않습니다. 표의 값은 수집 시점의 원화(KRW) 환산 가격이어서 현지 통화 요금 개편, 원화 환율 변동, 데이터 보정이 함께 반영됩니다. 짧은 기간의 등락 상당수는 환율 요인일 수 있으므로, 공식 요금 변경 여부는 YouTube 공식 안내에서 별도로 확인해야 합니다.",
    },
    {
      q: "가격 데이터는 어떻게, 얼마나 자주 수집되나요?",
      a: `실시간 시계열이 아니라 수집 시점별 스냅샷 방식입니다. 현재 비교에 사용된 시점은 ${dates}이며, 환율은 공개 환율 API 기준(${fxDate})으로 갱신됩니다. 스냅샷 사이의 일별 가격은 제공하지 않습니다.`,
    },
    {
      q: "과거 특정 시점의 공식 요금도 확인할 수 있나요?",
      a: "아니요. 본 페이지는 자체 수집 스냅샷만 제공하며, Google/YouTube의 공식 가격 변경 이력 아카이브가 아닙니다. 특정 시점의 공식 요금이나 인상 공지는 YouTube 고객센터 등 공식 채널에서 확인해야 정확합니다.",
    },
    {
      q: "환율이 바뀌면 순위도 바뀌나요?",
      a: "네. 원화 환산 최저가 순위는 환율에 따라 달라질 수 있습니다. 현지 요금이 그대로여도 해당 통화가 원화 대비 강세면 환산 가격이 올라 순위가 밀리고, 약세면 내려갑니다. 순위와 함께 현지 통화 가격을 같이 확인하는 것이 안전합니다.",
    },
  ];
});

const seoJsonLd = computed<Record<string, unknown> | undefined>(() => {
  if (!faqItems.value.length) return undefined;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.value.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
});

useSEO({
  title: pageTitle,
  description: pageDescription,
  jsonLd: seoJsonLd,
});

function fmtKrw(value: number | null | undefined): string {
  if (value == null) return "-";
  return `${formatNumber(Math.round(value))}원`;
}

function fmtLocal(row: TrendRow): string {
  if (row.localMonthly == null) return "-";
  return `${formatNumber(row.localMonthly)} ${row.currency}`;
}

function fmtDelta(value: number | null | undefined): string {
  if (value == null) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value)}원`;
}

function fmtPercent(value: number | null | undefined): string {
  if (value == null) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}%`;
}

async function loadTrendData(): Promise<void> {
  if (!serviceSlug.value) return;
  loading.value = true;
  error.value = null;

  try {
    await loadServices();
    trends.value = await fetchTrends(serviceSlug.value);
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : "트렌드 데이터를 불러오지 못했습니다.";
  } finally {
    loading.value = false;
  }
}

onMounted(loadTrendData);
watch(serviceSlug, async () => {
  try {
    await loadTrendData();
  } catch {
    // loadTrendData 내부에서 error ref로 처리됨
  }
});
</script>

<template>
  <div class="container py-6">
    <div v-if="loading">
      <h1 class="sr-only">{{ trendHeading }}</h1>
      <LoadingSpinner message="트렌드 데이터를 불러오는 중..." />
    </div>

    <div v-else-if="error" class="text-center py-20">
      <h1 class="sr-only">{{ trendHeading }}</h1>
      <p class="text-destructive text-body">{{ error }}</p>
    </div>

    <div v-else-if="trends" class="third-rate-board">
      <section class="retro-panel overflow-hidden mb-4">
        <div class="retro-titlebar">
          <h1 class="retro-title">{{ trendHeading }}</h1>
          <span class="retro-kbd">TOP 10</span>
        </div>
        <div class="retro-panel-content flex items-center justify-between flex-wrap gap-3">
          <p class="text-caption text-muted-foreground">
            기준일: {{ trends.asOf || "-" }} · 비교 기준: {{ trends.previousSnapshotDate || "-" }} ·
            수집 시점별 스냅샷 비교(실시간 시계열 아님)
          </p>
          <div class="flex items-center gap-2 text-caption">
            <RouterLink :to="`/${serviceSlug}`" class="retro-button-subtle">가격표 보기</RouterLink>
          </div>
        </div>
      </section>

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card class="retro-panel overflow-hidden">
          <div class="retro-titlebar">
            <h2 class="retro-title">최저가 TOP 10 (개인)</h2>
          </div>
          <CardContent>
            <Table class="w-max min-w-full whitespace-nowrap">
              <caption class="sr-only">개인 요금제 최저가 상위 10개 국가</caption>
              <TableHeader class="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead scope="col" class="text-body text-muted-foreground">#</TableHead>
                  <TableHead scope="col" class="text-body text-muted-foreground">국가</TableHead>
                  <TableHead scope="col" class="text-body text-muted-foreground text-right">현지 가격</TableHead>
                  <TableHead scope="col" class="text-body text-muted-foreground text-right">KRW</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="(row, index) in trends.cheapest" :key="`cheap-${row.countryCode}`">
                  <TableCell>{{ index + 1 }}</TableCell>
                  <TableCell>
                    <RouterLink
                      :to="`/${serviceSlug}/${row.countryCode.toLowerCase()}`"
                      class="inline-flex items-center gap-2 hover:text-primary transition-colors font-semibold"
                    >
                      <span class="text-body">{{ countryFlag(row.countryCode) }}</span>
                      <span class="text-body">{{ row.country }}</span>
                    </RouterLink>
                  </TableCell>
                  <TableCell class="text-caption text-muted-foreground text-right tabular-nums">{{ fmtLocal(row) }}</TableCell>
                  <TableCell class="font-semibold text-body text-foreground text-right tabular-nums">{{ fmtKrw(row.krw) }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card class="retro-panel overflow-hidden">
          <div class="retro-titlebar">
            <h2 class="retro-title">한국 대비 절약률 TOP 10</h2>
          </div>
          <CardContent>
            <Table class="w-max min-w-full whitespace-nowrap">
              <caption class="sr-only">한국 대비 절약률 상위 10개 국가</caption>
              <TableHeader class="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead scope="col" class="text-body text-muted-foreground">#</TableHead>
                  <TableHead scope="col" class="text-body text-muted-foreground">국가</TableHead>
                  <TableHead scope="col" class="text-body text-muted-foreground text-right">절약률</TableHead>
                  <TableHead scope="col" class="text-body text-muted-foreground text-right">KRW</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="(row, index) in trends.highestSavings" :key="`save-${row.countryCode}`">
                  <TableCell>{{ index + 1 }}</TableCell>
                  <TableCell>
                    <RouterLink
                      :to="`/${serviceSlug}/${row.countryCode.toLowerCase()}`"
                      class="inline-flex items-center gap-2 hover:text-primary transition-colors font-semibold"
                    >
                      <span class="text-body">{{ countryFlag(row.countryCode) }}</span>
                      <span class="text-body">{{ row.country }}</span>
                    </RouterLink>
                  </TableCell>
                  <TableCell class="text-body text-right tabular-nums text-savings">-{{ row.savingsPercent }}%</TableCell>
                  <TableCell class="font-semibold text-body text-foreground text-right tabular-nums">{{ fmtKrw(row.krw) }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card class="mt-4 retro-panel overflow-hidden">
        <div class="retro-titlebar">
          <h2 class="retro-title">최근 가격 변동 TOP 10 (개인 · KRW)</h2>
        </div>
        <CardContent>
          <Table class="w-max min-w-full whitespace-nowrap">
            <caption class="sr-only">최근 개인 요금제 가격 변동 상위 10개 국가</caption>
            <TableHeader class="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead scope="col" class="text-body text-muted-foreground">#</TableHead>
                <TableHead scope="col" class="text-body text-muted-foreground">국가</TableHead>
                <TableHead scope="col" class="text-body text-muted-foreground text-right">이전</TableHead>
                <TableHead scope="col" class="text-body text-muted-foreground text-right">현재</TableHead>
                <TableHead scope="col" class="text-body text-muted-foreground text-right">변동</TableHead>
                <TableHead scope="col" class="text-body text-muted-foreground text-right">변동률</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="(row, index) in trends.biggestDrops" :key="`drop-${row.countryCode}`">
                <TableCell>{{ index + 1 }}</TableCell>
                <TableCell>
                  <RouterLink
                    :to="`/${serviceSlug}/${row.countryCode.toLowerCase()}`"
                    class="inline-flex items-center gap-2 hover:text-primary transition-colors font-semibold"
                  >
                    <span class="text-body">{{ countryFlag(row.countryCode) }}</span>
                    <span class="text-body">{{ row.country }}</span>
                  </RouterLink>
                </TableCell>
                <TableCell class="text-caption text-muted-foreground text-right tabular-nums">{{ fmtKrw(row.previousKrw) }}</TableCell>
                <TableCell class="font-semibold text-body text-foreground text-right tabular-nums">{{ fmtKrw(row.currentKrw) }}</TableCell>
                <TableCell class="text-body text-right tabular-nums" :class="row.changeKrw < 0 ? 'text-savings' : 'text-destructive'">
                  {{ fmtDelta(row.changeKrw) }}
                </TableCell>
                <TableCell class="text-body text-right tabular-nums" :class="row.changePercent < 0 ? 'text-savings' : 'text-destructive'">
                  {{ fmtPercent(row.changePercent) }}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card v-if="timelineRows.length" class="mt-4 retro-panel overflow-hidden">
        <div class="retro-titlebar">
          <h2 class="retro-title">수집 시점별 가격 (기준국 + 변동 상위)</h2>
        </div>
        <CardContent>
          <Table class="w-max min-w-full whitespace-nowrap">
            <caption class="sr-only">수집 시점별 원화 환산 가격 비교</caption>
            <TableHeader class="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead scope="col" class="text-body text-muted-foreground">국가</TableHead>
                <TableHead
                  v-for="date in timelineDates"
                  :key="`th-${date}`"
                  scope="col"
                  class="text-body text-muted-foreground text-right"
                >
                  {{ date }}
                </TableHead>
                <TableHead scope="col" class="text-body text-muted-foreground text-right">직전 대비</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="row in timelineRows" :key="`timeline-${row.countryCode}`">
                <TableCell>
                  <RouterLink
                    :to="`/${serviceSlug}/${row.countryCode.toLowerCase()}`"
                    class="inline-flex items-center gap-2 hover:text-primary transition-colors font-semibold"
                  >
                    <span class="text-body">{{ countryFlag(row.countryCode) }}</span>
                    <span class="text-body">{{ row.country }}</span>
                  </RouterLink>
                </TableCell>
                <TableCell
                  v-for="date in timelineDates"
                  :key="`td-${row.countryCode}-${date}`"
                  class="text-caption text-muted-foreground text-right tabular-nums"
                >
                  {{ fmtKrw(timelineKrwAt(row, date)) }}
                </TableCell>
                <TableCell
                  class="text-body text-right tabular-nums"
                  :class="(row.changePercent ?? 0) < 0 ? 'text-savings' : (row.changePercent ?? 0) > 0 ? 'text-destructive' : ''"
                >
                  {{ fmtPercent(row.changePercent) }}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p class="text-tiny text-muted-foreground pt-2">
            원화 환산 기준이라 현지 요금이 그대로여도 환율에 따라 표시값이 달라질 수 있습니다.
            실시간·일 단위 시계열은 제공하지 않습니다.
          </p>
        </CardContent>
      </Card>

      <!--
        "이 변동을 읽는 법" 카드는 제거했다 — 같은 주제를 프리렌더판이 실제 수치
        (하락·상승 개국 수, 변동률 중간값, 최대 변동국)와 함께 설명하고, 아래
        SeoRichContent가 그 문구를 그대로 렌더한다. 두 벌을 두면 같은 설명이 두 번 나온다.
      -->
      <Card v-if="changelogEntries.length" class="mt-4 retro-panel overflow-hidden">
        <div class="retro-titlebar">
          <h2 class="retro-title">가격 데이터 갱신·보정 기록</h2>
        </div>
        <CardContent>
          <Table class="w-max min-w-full whitespace-nowrap">
            <caption class="sr-only">가격 데이터 갱신 및 보정 기록</caption>
            <TableHeader class="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead scope="col" class="text-body text-muted-foreground">일자</TableHead>
                <TableHead scope="col" class="text-body text-muted-foreground">국가</TableHead>
                <TableHead scope="col" class="text-body text-muted-foreground text-right">이전</TableHead>
                <TableHead scope="col" class="text-body text-muted-foreground text-right">현재</TableHead>
                <TableHead scope="col" class="text-body text-muted-foreground">메모</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="entry in changelogEntries" :key="entry.id">
                <TableCell class="text-caption text-muted-foreground tabular-nums">
                  {{ (entry.updatedAt || "").slice(0, 10) || "-" }}
                </TableCell>
                <TableCell class="text-body font-semibold">
                  <span>{{ countryFlag(entry.countryCode || "") }}</span>
                  {{ changelogCountryName(entry.countryCode) }}
                </TableCell>
                <TableCell class="text-caption text-muted-foreground text-right tabular-nums">{{ fmtKrw(entry.previousKrw) }}</TableCell>
                <TableCell class="text-body text-right tabular-nums">{{ fmtKrw(entry.currentKrw) }}</TableCell>
                <TableCell class="text-caption text-muted-foreground">{{ entry.note || "-" }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p class="text-tiny text-muted-foreground pt-2">
            수집 데이터의 보정·재확인 기록입니다. Google/YouTube의 공식 요금 개편 공지와는 다를 수 있습니다.
          </p>
        </CardContent>
      </Card>

    </div>

    <!--
      프리렌더에만 있던 해설(변동 읽는 법·대륙별 평균·비싼 국가·가격 격차·관련 링크)을
      화면에도 렌더한다. 위 카드들이 라이브로 보여주는 표는 seo-content.mjs에서
      live:true로 표시돼 여기서 제외된다.

      조건 분기 바깥에 두는 이유: 이 문구는 커밋된 시드에서 나오므로 API가 죽어도
      보여줄 수 있어야 하고(로딩·에러 화면이 빈 페이지가 되지 않는다),
      하이드레이션 패리티 게이트도 API 상태와 무관하게 결정적으로 돌 수 있다.
    -->
    <Card class="mt-4 retro-panel overflow-hidden">
      <CardContent class="px-4 py-3">
        <SeoRichContent route="/youtube-premium/trends" embedded />
      </CardContent>
    </Card>

    <Card v-if="faqItems.length" class="mt-4 retro-panel overflow-hidden">
      <div class="retro-titlebar">
        <h2 class="retro-title">자주 묻는 질문</h2>
      </div>
      <CardContent class="px-4 py-2">
        <Accordion type="multiple" class="w-full">
          <AccordionItem v-for="(item, i) in faqItems" :key="i" :value="`trends-faq-${i}`">
            <article>
              <AccordionTrigger class="text-caption">{{ item.q }}</AccordionTrigger>
              <AccordionContent>{{ item.a }}</AccordionContent>
            </article>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  </div>
</template>

<style scoped>
.third-rate-board :deep(.retro-title) {
  font-size: clamp(1.25rem, 2.6vw, 2rem);
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
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

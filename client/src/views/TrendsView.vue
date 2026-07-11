<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { fetchTrends, type TrendRow, type TrendsResponse } from "@/api";
import { useServices } from "@/composables/useServices";
import { useSEO } from "@/composables/useSEO";
import { formatNumber, countryFlag } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { LoadingSpinner } from "@/components/ui/loading";

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
  return `${serviceName} 국가별·나라별 최근 가격 하락 국가와 절약률 상위 국가를 확인하세요. 구독료 변동 추이.`;
});

useSEO({
  title: pageTitle,
  description: pageDescription,
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
            기준일: {{ trends.asOf || "-" }} · 비교 기준: {{ trends.previousSnapshotDate || "-" }}
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
            <Table>
              <TableHeader class="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead class="text-body text-muted-foreground">#</TableHead>
                  <TableHead class="text-body text-muted-foreground">국가</TableHead>
                  <TableHead class="text-body text-muted-foreground text-right">현지 가격</TableHead>
                  <TableHead class="text-body text-muted-foreground text-right">KRW</TableHead>
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
            <Table>
              <TableHeader class="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead class="text-body text-muted-foreground">#</TableHead>
                  <TableHead class="text-body text-muted-foreground">국가</TableHead>
                  <TableHead class="text-body text-muted-foreground text-right">절약률</TableHead>
                  <TableHead class="text-body text-muted-foreground text-right">KRW</TableHead>
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
          <Table>
            <TableHeader class="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead class="text-body text-muted-foreground">#</TableHead>
                <TableHead class="text-body text-muted-foreground">국가</TableHead>
                <TableHead class="text-body text-muted-foreground text-right">이전</TableHead>
                <TableHead class="text-body text-muted-foreground text-right">현재</TableHead>
                <TableHead class="text-body text-muted-foreground text-right">변동</TableHead>
                <TableHead class="text-body text-muted-foreground text-right">변동률</TableHead>
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
    </div>
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

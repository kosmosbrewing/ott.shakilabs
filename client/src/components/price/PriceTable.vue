<script setup lang="ts">
import { computed } from "vue";
import { ArrowDown, ArrowUp } from "lucide-vue-next";
import type { CountryPrice } from "@/api";
import { Table, TableHeader, TableBody, TableRow, TableHead } from "@/components/ui/table";
import PriceRow from "./PriceRow.vue";
import type { SortOrder } from "@/composables/usePrices";

const props = defineProps<{
  prices: CountryPrice[];
  selectedPlan: string;
  sortOrder: SortOrder;
  baseCountryPrice: CountryPrice | null;
  serviceSlug: string;
}>();

// 기준 국가의 KRW 환산가 (절약률 계산 기준)
const baseKrw = computed<number | null>(() => {
  if (!props.baseCountryPrice) return null;
  return props.baseCountryPrice.converted?.[props.selectedPlan]?.krw ?? null;
});
</script>

<template>
  <div>
    <Table wrapper-class="max-h-[82vh] overflow-auto">
      <caption class="sr-only">국가별 구독 요금 가격표</caption>
      <TableHeader class="[&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:bg-background/95 [&_th]:backdrop-blur-sm">
        <TableRow>
          <TableHead scope="col" class="min-w-0">국가</TableHead>
          <TableHead scope="col" class="text-right w-[116px] hidden sm:table-cell text-muted-foreground">현지 가격</TableHead>
          <TableHead scope="col" class="text-right w-[64px] hidden sm:table-cell text-muted-foreground">달러</TableHead>
          <TableHead scope="col" class="text-right w-[112px]">
            <span class="inline-flex items-center justify-end gap-1">
              원화
              <ArrowUp
                v-if="sortOrder === 'asc'"
                class="h-3.5 w-3.5 text-primary"
                aria-label="오름차순 정렬"
              />
              <ArrowDown
                v-else
                class="h-3.5 w-3.5 text-primary"
                aria-label="내림차순 정렬"
              />
            </span>
          </TableHead>
          <TableHead scope="col" class="text-right w-[64px]">절약률</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <template v-for="(item, index) in prices" :key="item.countryCode">
          <PriceRow
            :item="item"
            :selected-plan="selectedPlan"
            :base-krw="baseKrw"
            :service-slug="serviceSlug"
            :rank="index + 1"
            :is-base="item.countryCode === props.baseCountryPrice?.countryCode"
            :sort-order="sortOrder"
          />
        </template>
      </TableBody>
    </Table>

    <!-- 데이터 없음 -->
    <div v-if="prices.length === 0" class="text-center py-12">
      <p class="text-body text-muted-foreground">해당 조건에 맞는 국가가 없습니다.</p>
    </div>
  </div>
</template>

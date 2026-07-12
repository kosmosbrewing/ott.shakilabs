<script setup lang="ts">
import { computed } from "vue";
import { Badge } from "@/components/ui/badge";
import { calcSavingsPercent } from "@/lib/utils";

const props = defineProps<{
  price: number;
  basePrice: number;
}>();

const percent = computed(() => calcSavingsPercent(props.price, props.basePrice));

// 양수 = 절약, 음수 = 더 비쌈
const label = computed(() => {
  if (percent.value === 0) return "동일";
  const abs = Math.abs(percent.value);
  const sign = percent.value > 0 ? "-" : "+";
  const display = abs >= 1 ? Math.round(abs) : abs.toFixed(1);
  return `${sign}${display}%`;
});

const variant = computed<"savings" | "destructive" | "neutral">(() => {
  if (percent.value > 0) return "savings";
  if (percent.value < 0) return "destructive";
  return "neutral";
});
</script>

<template>
  <Badge :variant="variant" class="h-5 min-w-[5ch] justify-center px-1.5 py-0 text-tiny font-bold tabular-nums leading-none !text-white">
    {{ label }}
  </Badge>
</template>

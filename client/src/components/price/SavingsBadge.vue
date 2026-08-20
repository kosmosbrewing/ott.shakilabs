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
  <!-- !text-white는 variant마다 다른 foreground 토큰을 전부 덮어써서 다크 절약 배지를
       2.37:1로 만들던 자리다. 토큰 짝(savings/destructive/neutral-foreground)에 맡긴다. -->
  <Badge :variant="variant" class="h-5 min-w-[5ch] justify-center px-1.5 py-0 text-tiny font-bold tabular-nums leading-none">
    {{ label }}
  </Badge>
</template>

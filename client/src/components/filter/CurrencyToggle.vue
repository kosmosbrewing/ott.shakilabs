<script setup lang="ts">
import type { DisplayCurrency } from "@/composables/usePrices";
import { cn } from "@/lib/utils";

defineProps<{
  modelValue: DisplayCurrency;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: DisplayCurrency): void;
}>();

const options: ReadonlyArray<{ value: DisplayCurrency; label: string }> = [
  { value: "krw", label: "₩ KRW" },
  { value: "usd", label: "$ USD" },
];
</script>

<template>
  <div class="inline-flex items-center gap-1 border-b border-border/70 pb-1">
    <button
      v-for="opt in options"
      :key="opt.value"
      :class="cn(
        'px-2.5 py-1 text-body font-medium border-b-2 border-transparent transition-colors',
        modelValue === opt.value
          ? 'text-primary border-primary'
          : 'text-muted-foreground hover:text-foreground hover:border-border/70'
      )"
      @click="emit('update:modelValue', opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

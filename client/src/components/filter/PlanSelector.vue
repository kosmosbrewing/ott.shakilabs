<script setup lang="ts">
import type { ServicePlan } from "@/api";
import { cn } from "@/lib/utils";

defineProps<{
  plans: ServicePlan[];
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();
</script>

<template>
  <div class="inline-flex flex-wrap items-center gap-1 border-b border-border/70 pb-1">
    <button
      v-for="plan in plans"
      :key="plan.id"
      :class="cn(
        'px-2.5 py-1 text-body font-medium border-b-2 border-transparent transition-colors',
        modelValue === plan.id
          ? 'text-primary border-primary'
          : 'text-muted-foreground hover:text-foreground hover:border-border/70'
      )"
      @click="emit('update:modelValue', plan.id)"
    >
      {{ plan.name }}
    </button>
  </div>
</template>

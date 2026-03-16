<script setup lang="ts">
import { cn } from "@/lib/utils";

type ContinentInfo = {
  name: string;
  [key: string]: unknown;
};

defineProps<{
  continents: Record<string, ContinentInfo>;
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();
</script>

<template>
  <div class="flex flex-wrap gap-1">
    <button
      :class="cn(
        'px-2.5 py-1 text-body font-medium border-b-2 border-transparent transition-colors',
        modelValue === 'all'
          ? 'text-primary border-primary'
          : 'text-muted-foreground hover:text-foreground hover:border-border/70'
      )"
      @click="emit('update:modelValue', 'all')"
    >
      전체
    </button>
    <button
      v-for="(info, key) in continents"
      :key="key"
      :class="cn(
        'px-2.5 py-1 text-body font-medium border-b-2 border-transparent transition-colors',
        modelValue === key
          ? 'text-primary border-primary'
          : 'text-muted-foreground hover:text-foreground hover:border-border/70'
      )"
      @click="emit('update:modelValue', key)"
    >
      {{ info.name }}
    </button>
  </div>
</template>

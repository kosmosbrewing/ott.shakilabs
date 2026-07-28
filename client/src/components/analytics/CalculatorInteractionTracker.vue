<script setup lang="ts">
import { onBeforeUnmount } from "vue";
import { trackEvent } from "@/lib/analytics";
import { createCalculatorAnalytics } from "@/utils/calculatorAnalytics";

const props = withDefaults(defineProps<{
  calculatorId: string;
  pagePath: string;
  canViewResult?: boolean;
}>(), {
  canViewResult: true,
});

const analytics = createCalculatorAnalytics({
  calculatorId: () => props.calculatorId,
  pagePath: () => props.pagePath,
  track: trackEvent,
  canViewResult: () => props.canViewResult,
});
onBeforeUnmount(analytics.dispose);

function recordButton(event: MouseEvent): void {
  if ((event.target as HTMLElement).closest("button")) {
    analytics.recordInteraction();
  }
}
</script>

<template>
  <div
    @input="analytics.recordInteraction"
    @change="analytics.recordInteraction"
    @click="recordButton"
  >
    <slot />
  </div>
</template>


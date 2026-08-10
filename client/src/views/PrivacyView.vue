<script setup lang="ts">
/**
 * 개인정보처리방침 — 문구는 scripts/seo-content.mjs가 단일 소스다.
 * 프리렌더 정적 HTML과 이 화면이 같은 문자열을 렌더하므로,
 * 하이드레이션 때 프리렌더 블록이 제거돼도 본문이 사라지지 않는다.
 */
import { useSEO } from "@/composables/useSEO";
import SeoRichContent from "@/components/seo/SeoRichContent.vue";

useSEO({
  title: "개인정보처리방침 | OTT 가격 비교",
  description:
    "OTT Watcher 개인정보처리방침입니다. 수집 항목, Google Analytics·AdSense 등 제3자 서비스, 쿠키와 맞춤 광고 거부 방법을 안내합니다.",
});
</script>

<template>
  <div class="container py-8">
    <SeoRichContent route="/privacy" />
  </div>
</template>

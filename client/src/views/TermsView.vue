<script setup lang="ts">
/**
 * 이용약관 — 문구는 scripts/seo-content.mjs가 단일 소스다.
 * 프리렌더 정적 HTML과 이 화면이 같은 문자열을 렌더하므로,
 * 하이드레이션 때 프리렌더 블록이 제거돼도 본문이 사라지지 않는다.
 */
import { useSEO } from "@/composables/useSEO";
import SeoRichContent from "@/components/seo/SeoRichContent.vue";

useSEO({
  title: "이용약관 | OTT 가격 비교",
  description: "OTT Watcher 서비스 이용약관입니다. 서비스 이용 조건, 데이터 정확성, 광고 안내 등을 확인하세요.",
});
</script>

<template>
  <div class="container py-8">
    <SeoRichContent route="/terms" />
  </div>
</template>

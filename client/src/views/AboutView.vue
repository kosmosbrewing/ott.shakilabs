<script setup lang="ts">
/**
 * 서비스 소개 — 문구는 scripts/seo-content.mjs가 단일 소스다.
 * 이전에는 프리렌더(7개 절)와 화면(카드 4장)이 따로 쓰여 있어 JS를 켜면
 * 본문의 3분의 2가 사라졌다. 지금은 같은 문자열을 양쪽이 렌더한다.
 */
import { useSEO } from "@/composables/useSEO";
import SeoRichContent from "@/components/seo/SeoRichContent.vue";

useSEO({
  title: "소개 | 유튜브 프리미엄 가격 비교",
  description: "유튜브 프리미엄 가격 비교 서비스의 데이터 출처와 갱신 주기를 안내합니다.",
});
</script>

<template>
  <div class="container py-8">
    <SeoRichContent route="/about" />
  </div>
</template>

<script setup lang="ts">
/**
 * 개인정보처리방침 — 문구는 scripts/seo-content.mjs가 단일 소스다.
 * 프리렌더 정적 HTML과 이 화면이 같은 문자열을 렌더하므로,
 * 하이드레이션 때 프리렌더 블록이 제거돼도 본문이 사라지지 않는다.
 */
import { useSEO } from "@/composables/useSEO";
import SeoRichContent from "@/components/seo/SeoRichContent.vue";
import { PRIVACY_META } from "../../scripts/page-meta.mjs";

// 프리렌더와 설명이 달랐다(크롤러는 한 줄짜리, 화면은 이 문장) — 같은 모듈로 맞춘다.
useSEO({
  title: PRIVACY_META.title,
  description: PRIVACY_META.description,
});
</script>

<template>
  <div class="container py-8">
    <SeoRichContent route="/privacy" />
  </div>
</template>

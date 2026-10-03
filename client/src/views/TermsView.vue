<script setup lang="ts">
/**
 * 이용약관 — 문구는 scripts/seo-content.mjs가 단일 소스다.
 * 프리렌더 정적 HTML과 이 화면이 같은 문자열을 렌더하므로,
 * 하이드레이션 때 프리렌더 블록이 제거돼도 본문이 사라지지 않는다.
 */
import { useSEO } from "@/composables/useSEO";
import SeoRichContent from "@/components/seo/SeoRichContent.vue";
import { TERMS_META } from "../../scripts/page-meta.mjs";

useSEO({
  title: TERMS_META.title,
  description: TERMS_META.description,
});
</script>

<template>
  <!-- 문서형 화면도 도구 화면과 같은 프레임(패키지 sh-container, 72rem)에서 시작한다.
       --prose는 글줄만 42rem으로 묶어 읽는 폭을 지키고, 제목·본문의 시작 x는 헤더와 같다. -->
  <div class="sh-container sh-container--prose py-8">
    <SeoRichContent route="/terms" />
  </div>
</template>

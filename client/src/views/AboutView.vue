<script setup lang="ts">
/**
 * 서비스 소개 — 문구는 scripts/seo-content.mjs가 단일 소스다.
 * 이전에는 프리렌더(7개 절)와 화면(카드 4장)이 따로 쓰여 있어 JS를 켜면
 * 본문의 3분의 2가 사라졌다. 지금은 같은 문자열을 양쪽이 렌더한다.
 */
import { useSEO } from "@/composables/useSEO";
import SeoRichContent from "@/components/seo/SeoRichContent.vue";
import { ABOUT_META } from "../../scripts/page-meta.mjs";

// 제목·설명은 프리렌더(routeToMeta("/about"))와 같은 모듈에서 나온다.
useSEO({
  title: ABOUT_META.title,
  description: ABOUT_META.description,
});
</script>

<template>
  <!-- 문서형 화면도 도구 화면과 같은 프레임(패키지 sh-container, 72rem)에서 시작한다.
       --prose는 글줄만 42rem으로 묶어 읽는 폭을 지키고, 제목·본문의 시작 x는 헤더와 같다. -->
  <div class="sh-container sh-container--prose py-8">
    <SeoRichContent route="/about" />
  </div>
</template>

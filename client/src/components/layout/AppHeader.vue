<script setup lang="ts">
// v3 §3.2 — 전역 검정 헤더는 패키지 ShGlobalHeader가 소유한다. 앱은 링크·탭 목록·테마 토글만 채운다.
//
// 왜 앱 자체 헤더를 버리는가: 이 앱만 0.3.13에 묶여 있던 동안 다른 11개 앱은 0.3.38 "순수 내비게이션"
// (로고 / 앱 이름 · 블로그·소개 · 테마 · ☰)으로 옮겨 갔다. 옛 헤더는 로고 + 가운데 회전 문구 + 토글 상자였고
// 회전 문구("최저가로 바꾸면 매달 … 절약", "치킨 N마리값")는 정보라 내비가 할 일이 아니며,
// 해외 요금 가입을 권하는 말투로 읽혔다. 같은 사이트인데 앱을 옮길 때마다 셸이 달라 보이던 것도 없어진다.
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import {
  ShGlobalHeader,
  ShPrimaryNavigation,
  ShThemeToggle,
  type GlobalHeaderLink,
} from "@shakilabs/ui";
import {
  PRIMARY_NAV_ITEMS,
  findActiveNavItem,
} from "../../../scripts/primary-nav-items.mjs";

// 블로그는 루트 앱이라 절대 경로(href), 소개는 이 앱 라우트라 RouterLink(to). 모바일에서는 ☰ 안으로 들어간다.
const links: GlobalHeaderLink[] = [
  { href: "/blog", label: "블로그" },
  { to: "/about", label: "소개" },
];

const route = useRoute();
const navActiveKey = computed(() => findActiveNavItem(route.path)?.key ?? "");
</script>

<template>
  <ShGlobalHeader
    app="ott"
    home-href="/"
    brand="ShakiLabs"
    :links="links"
    :nav-items="PRIMARY_NAV_ITEMS"
    :nav-active-key="navActiveKey"
    :link-component="RouterLink"
  >
    <template #utility>
      <!-- index.html 첫 페인트 스크립트와 같은 키 — 다르면 새로고침마다 테마가 되돌아간다 -->
      <ShThemeToggle storage-key="ottwatcher:theme:v1" />
    </template>
  </ShGlobalHeader>

  <!-- 모바일(<48rem)에서는 패키지가 이 탭 줄을 숨기고 헤더 ☰가 같은 목록을 연다(0.3.38). -->
  <ShPrimaryNavigation
    :items="PRIMARY_NAV_ITEMS"
    :active-key="navActiveKey"
    :link-component="RouterLink"
    aria-label="주요 메뉴"
  />
</template>

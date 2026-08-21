<script setup lang="ts">
import { RouterLink } from "vue-router";
import { ShSiteFooter } from "@shakilabs/ui";
import { FOOTER_SECTIONS } from "@/data/footerNav";

const year = new Date().getFullYear();

const policyLinks = [
  // 블로그는 root 앱(shakilabs.com/blog) 소유라 앱 라우터로는 못 간다.
  // href를 주면 ShSiteFooter가 RouterLink 대신 <a href>로 렌더해 절대경로가 그대로 나간다.
  { to: "", href: "/blog", label: "블로그" },
  { to: "/about", label: "사이트 안내" },
  { to: "/terms", label: "이용약관" },
  { to: "/privacy", label: "개인정보 처리방침" },
];
</script>

<template>
  <ShSiteFooter
    app="ott"
    :sections="FOOTER_SECTIONS"
    :policy-links="policyLinks"
    note="구독료는 각 서비스 공식 페이지의 조회 시점 스냅샷이며, 실제 결제 금액은 환율·부가세에 따라 달라질 수 있습니다."
    site-label="shakilabs.com/ott"
    :copyright="`Copyright © ${year} shakilabs.com`"
    :link-component="RouterLink"
  />
</template>

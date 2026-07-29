<script setup lang="ts">
import { RouterLink } from "vue-router";
import { ShSiteFooter } from "@shakilabs/ui";
import { FOOTER_SECTIONS } from "@/data/footerNav";

const year = new Date().getFullYear();

const policyLinks = [
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

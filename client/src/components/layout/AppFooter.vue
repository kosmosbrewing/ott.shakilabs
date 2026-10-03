<script setup lang="ts">
import { RouterLink } from "vue-router";
import { ShSiteFooter } from "@shakilabs/ui";
import { FOOTER_SECTIONS } from "@/data/footerNav";

const year = new Date().getFullYear();

// 약관 안내를 모든 화면 푸터에 둔다. 예전에는 프리렌더 푸터(하이드레이션 때 제거)에 옅은 회색으로만 있어
// JS가 켜진 화면에서는 페이지 맨 아래 해설까지 내려가야 보였다.
const FOOTER_NOTE =
  "구독료는 각 서비스 공식 페이지의 조회 시점 스냅샷이며, 실제 결제 금액은 환율·부가세에 따라 달라질 수 있습니다. " +
  "다른 나라 요금은 그 나라에 실제로 거주하고 현지 결제 수단을 쓸 때만 적용됩니다 — VPN·해외 주소로 가입하면 YouTube 약관 위반이 될 수 있습니다.";

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
    :note="FOOTER_NOTE"
    site-label="shakilabs.com/ott"
    :copyright="`Copyright © ${year} shakilabs.com`"
    :link-component="RouterLink"
  />
</template>

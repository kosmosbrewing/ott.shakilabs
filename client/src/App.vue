<script setup lang="ts">
import { onMounted } from "vue";
import { ShSurface } from "@shakilabs/ui";
import AppHeader from "@/components/layout/AppHeader.vue";
import AppFooter from "@/components/layout/AppFooter.vue";
import AlertHost from "@/components/ui/alert/AlertHost.vue";
import { useMyPlan } from "@/composables/useMyPlan";
import { useServices } from "@/composables/useServices";
import { useSEO } from "@/composables/useSEO";
import { getSiteUrl } from "@/lib/site";
import { HOME_META } from "@/lib/pageMeta";

const siteUrl = getSiteUrl();

// Organization + WebSite 구조화 데이터 (전역 1회).
// 제목·설명은 각 뷰가 덮어쓰지만, 덮어쓰지 않는 화면에서 새어 나가도 사실이어야 한다 —
// 예전 값은 수록하지 않는 넷플릭스·디즈니+를 비교한다고 말했다.
useSEO({
  title: HOME_META.title,
  description: HOME_META.description,
  jsonLd: {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "ShakiLabs",
        url: siteUrl,
        logo: `${siteUrl}/favicon.png`,
      },
      {
        "@type": "WebSite",
        name: "OTT 구독료 비교",
        url: siteUrl,
        description: "유튜브 프리미엄 국가별 구독료 비교",
        potentialAction: {
          "@type": "SearchAction",
          target: `${siteUrl}/{serviceSlug}`,
          "query-input": "required name=serviceSlug",
        },
      },
    ],
  },
});

const { services, loadServices } = useServices();
// "내 기준 설정" 모달은 진입점(옛 헤더 탭)과 함께 빠졌다(순수 내비게이션).
// 이미 저장된 기준은 계속 적용한다 — VS 비교·요금제 탭이 이 값을 읽는다.
const { hydrateMyPlan } = useMyPlan();

onMounted(async () => {
  await loadServices();
  hydrateMyPlan(services.value);
});
</script>

<template>
  <ShSurface
    as="div"
    variant="plain"
    padding="none"
    class="design-system-shell min-h-screen flex flex-col bg-background"
  >
    <AppHeader />
    <!-- ShGlobalHeader의 "본문 바로가기"(#main-content)가 닿을 곳 -->
    <main id="main-content" tabindex="-1" class="text-resize-layout flex-1 relative">
      <RouterView v-slot="{ Component }">
        <Transition name="page-fade" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>
    <AppFooter />
    <AlertHost />
  </ShSurface>
</template>

<style scoped>
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.2s ease;
}

.page-fade-enter-from,
.page-fade-leave-to {
  opacity: 0;
}
</style>

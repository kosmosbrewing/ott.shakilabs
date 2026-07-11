<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ShSurface } from "@shakilabs/ui";
import AppHeader from "@/components/layout/AppHeader.vue";
import AppFooter from "@/components/layout/AppFooter.vue";
import AlertHost from "@/components/ui/alert/AlertHost.vue";
import MyPlanModal from "@/components/onboarding/MyPlanModal.vue";
import { useMyPlan } from "@/composables/useMyPlan";
import { useServices } from "@/composables/useServices";
import { useSEO } from "@/composables/useSEO";
import { getSiteUrl } from "@/lib/site";

const siteUrl = getSiteUrl();

// Organization + WebSite 구조화 데이터 (전역 1회)
useSEO({
  title: "OttWatcher — OTT 구독 가격 비교",
  description: "넷플릭스, 디즈니+, 유튜브 프리미엄 등 OTT 서비스 국가별 구독 가격을 한눈에 비교하세요.",
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
        name: "OttWatcher",
        url: siteUrl,
        description: "OTT 서비스 국가별 구독 가격 비교 플랫폼",
        potentialAction: {
          "@type": "SearchAction",
          target: `${siteUrl}/{serviceSlug}`,
          "query-input": "required name=serviceSlug",
        },
      },
    ],
  },
});

const showMyPlanModal = ref(false);

const { services, loadServices } = useServices();
const { hydrateMyPlan } = useMyPlan();

function openMyPlanModal(): void {
  showMyPlanModal.value = true;
}

function closeMyPlanModal(): void {
  showMyPlanModal.value = false;
}

function postponeMyPlanModal(): void {
  closeMyPlanModal();
}

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
    <AppHeader @open-my-plan="openMyPlanModal" />
    <main class="flex-1 relative">
      <RouterView v-slot="{ Component }">
        <Transition name="page-fade" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>
    <AppFooter />
    <AlertHost />
    <MyPlanModal
      v-if="showMyPlanModal"
      @complete="closeMyPlanModal"
      @later="postponeMyPlanModal"
    />
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

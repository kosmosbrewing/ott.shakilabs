<script setup lang="ts">
import { onMounted } from "vue";
import { RouterLink } from "vue-router";
import { ShSurface, ShText } from "@shakilabs/ui";
import { useServices } from "@/composables/useServices";
import { useSEO } from "@/composables/useSEO";
import { getSiteUrl } from "@/lib/site";

const { services, loading, error, loadServices } = useServices();
const siteUrl = getSiteUrl();

useSEO({
  title: "OTT 구독료 국가별 가격 비교 | 유튜브 프리미엄·넷플릭스 나라별 최저가",
  description:
    "유튜브 프리미엄(YouTube Premium), 넷플릭스 등 OTT 서비스 국가별·나라별 구독료를 현재 환율 기준으로 비교. 최저가 국가 순위와 절약률.",
  ogImage: `${siteUrl}/og-image.png`,
  jsonLd: {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "OTT 구독료 국가별 가격 비교",
    url: siteUrl,
    description: "유튜브 프리미엄·넷플릭스 등 OTT 서비스 국가별·나라별 구독료 최저가 비교",
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  },
});

onMounted(() => {
  void loadServices();
});
</script>

<template>
  <div class="container py-6">
    <h1 class="sr-only">OTT 서비스 국가별 가격 비교 — 나라별 구독료 최저가</h1>
    <ShSurface as="section" variant="outlined" padding="none" class="overflow-hidden">
      <header class="border-b border-border px-4 py-4 sm:px-6">
        <ShText as="h2" variant="title">서비스 목록</ShText>
        <ShText class="mt-1" variant="caption" tone="muted">
          서비스별 국가 가격과 요금제를 같은 기준으로 확인하세요.
        </ShText>
      </header>

      <div class="p-4 sm:p-6">
        <div v-if="loading" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ShSurface v-for="i in 4" :key="i" class="animate-pulse" padding="md">
            <div class="mb-3 h-5 bg-muted"></div>
            <div class="h-3 w-2/3 bg-muted"></div>
          </ShSurface>
        </div>

        <div v-else-if="error" class="py-12">
          <ShText align="center" tone="danger">{{ error }}</ShText>
        </div>

        <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <RouterLink
            v-for="service in services"
            :key="service.id"
            :to="`/${service.slug}`"
            class="group block"
          >
            <ShSurface class="h-full transition-colors group-hover:border-primary" padding="md">
              <div class="flex items-center justify-between gap-3">
                <div class="flex min-w-0 items-center gap-3">
                  <div
                    class="flex h-10 w-10 shrink-0 items-center justify-center border border-border text-body font-bold text-white"
                    :style="{ backgroundColor: service.color }"
                  >
                    {{ service.name.charAt(0) }}
                  </div>
                  <div class="min-w-0">
                    <ShText as="h3" class="truncate" variant="heading">{{ service.name }}</ShText>
                    <ShText class="truncate" variant="caption" tone="muted">
                      {{ service.plans.map((p) => p.name).join(" · ") }}
                    </ShText>
                  </div>
                </div>
                <ShText class="shrink-0" variant="label" tone="primary">비교하기 →</ShText>
              </div>
            </ShSurface>
          </RouterLink>
        </div>
      </div>
    </ShSurface>
  </div>
</template>

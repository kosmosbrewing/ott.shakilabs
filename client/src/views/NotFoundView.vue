<script setup lang="ts">
import { useRouter } from "vue-router";
import { useSEO } from "@/composables/useSEO";
import { NOT_FOUND_META } from "../../scripts/page-meta.mjs";

const router = useRouter();

// 앱 이름을 남기는 레시피 — "페이지를 찾을 수 없습니다 | ShakiLabs"는 12개 앱이 똑같아진다.
// 없는 주소가 색인되지 않게 noindex.
useSEO({
  title: NOT_FOUND_META.title,
  description: NOT_FOUND_META.description,
  noindex: true,
});

function goHome(): void {
  router.push("/");
}
</script>

<template>
  <section class="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
    <h1 class="text-7xl font-bold text-primary mb-4">404</h1>
    <p class="text-xl text-muted-foreground mb-2">
      페이지를 찾을 수 없습니다
    </p>
    <p class="text-sm text-muted-foreground mb-8">
      요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.
    </p>
    <button
      class="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
      @click="goHome"
    >
      홈으로 돌아가기
    </button>
  </section>
</template>

<script setup lang="ts">
import { RouterLink } from "vue-router";
import { ShText } from "@shakilabs/ui";
</script>

<template>
  <footer class="mt-8 border-t border-border bg-background">
    <div class="container py-5">
      <div class="flex flex-col gap-3">
        <div class="flex flex-wrap items-center gap-3">
          <a href="/ott" class="retro-button-subtle">홈으로</a>
          <RouterLink to="/about" class="retro-button-subtle">사이트 안내</RouterLink>
          <RouterLink to="/privacy" class="retro-button-subtle">개인정보 처리방침</RouterLink>
          <RouterLink to="/terms" class="retro-button-subtle">이용약관</RouterLink>
        </div>
        <ShText as="p" variant="label" tone="muted">Copyright © shakilabs.com</ShText>
      </div>
    </div>
  </footer>
</template>

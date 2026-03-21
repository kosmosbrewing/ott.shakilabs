<script setup lang="ts">
import type { Component } from "vue";
import { ArrowRight, CreditCard, Banknote, Calculator } from "lucide-vue-next";

type RelatedServiceItem = {
  title: string;
  description: string;
  href: string;
  icon: Component;
};

const items: RelatedServiceItem[] = [
  {
    title: "해외결제 카드 비교",
    description: "해외 구독 결제 시 수수료가 적은 카드를 비교합니다.",
    href: "/card/overseas-card",
    icon: CreditCard,
  },
  {
    title: "환전 수수료 비교",
    description: "은행·환전소별 환율과 수수료를 비교해 환전 비용을 줄입니다.",
    href: "/travel/exchange",
    icon: Banknote,
  },
  {
    title: "연봉 실수령액 계산",
    description: "구독료를 포함한 월 고정지출과 실수령액을 함께 점검합니다.",
    href: "/finance/salary",
    icon: Calculator,
  },
];
</script>

<template>
  <section class="retro-panel overflow-hidden">
    <div class="retro-titlebar rounded-t-2xl">
      <h2 class="retro-title">관련 서비스</h2>
    </div>
    <div class="retro-panel-content space-y-4">
      <p class="text-caption leading-relaxed text-muted-foreground">
        구독료를 비교했다면 해외결제 카드, 환전 수수료, 실수령액도 함께 확인해 보세요.
      </p>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <a
          v-for="item in items"
          :key="item.href"
          :href="item.href"
          class="group flex flex-col rounded-[1.6rem] border border-border/70 bg-card p-4 text-left transition-[background-color,border-color,transform,box-shadow] duration-200 hover:-translate-y-[1px] hover:border-primary/25 hover:bg-muted/15"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-body font-bold text-foreground">{{ item.title }}</p>
              <p class="mt-1.5 text-caption text-muted-foreground">{{ item.description }}</p>
            </div>
            <span class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <component :is="item.icon" class="h-5 w-5" />
            </span>
          </div>
          <p class="mt-3 inline-flex items-center gap-1 text-caption font-semibold text-primary">
            바로 가기
            <ArrowRight class="h-3.5 w-3.5" />
          </p>
        </a>
      </div>
    </div>
  </section>
</template>

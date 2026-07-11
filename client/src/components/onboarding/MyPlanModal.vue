<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useServices } from "@/composables/useServices";
import { useMyPlan } from "@/composables/useMyPlan";
import { countryFlag } from "@/lib/utils";
import { LoadingSpinner } from "@/components/ui/loading";

const emit = defineEmits<{
  (e: "complete"): void;
  (e: "later"): void;
}>();

const { services, loading, error, loadServices } = useServices();
const { selectedPlan, selectedCountry, saveMyPlan } = useMyPlan();

const step = ref<1 | 2>(1);
const selectedPlanId = ref("");
const selectedCountryCode = ref("KR");
const submitError = ref("");

const COUNTRIES = [
  { code: "KR", name: "한국" },
  { code: "US", name: "미국" },
  { code: "JP", name: "일본" },
  { code: "GB", name: "영국" },
  { code: "DE", name: "독일" },
  { code: "FR", name: "프랑스" },
  { code: "CA", name: "캐나다" },
  { code: "AU", name: "호주" },
  { code: "TR", name: "튀르키예" },
  { code: "IN", name: "인도" },
  { code: "AR", name: "아르헨티나" },
  { code: "BR", name: "브라질" },
  { code: "PH", name: "필리핀" },
  { code: "UA", name: "우크라이나" },
  { code: "PL", name: "폴란드" },
  { code: "MX", name: "멕시코" },
  { code: "EG", name: "이집트" },
  { code: "ZA", name: "남아프리카" },
  { code: "NG", name: "나이지리아" },
  { code: "TH", name: "태국" },
  { code: "VN", name: "베트남" },
];

// 현재 유튜브 프리미엄 고정 — 서비스 추가 시 서비스 선택 UI 복원
const currentService = computed(() =>
  services.value.find((service) => service.slug === "youtube-premium") ?? services.value[0] ?? null
);

const availablePlans = computed(() => currentService.value?.plans ?? []);

const canGoStep2 = computed(() => !!selectedPlanId.value);

function handleSelectPlan(planId: string): void {
  selectedPlanId.value = planId;
}

function goToStep2(): void {
  if (!canGoStep2.value) return;
  step.value = 2;
}

function goToStep1(): void {
  step.value = 1;
}

function handleSelectCountry(code: string): void {
  selectedCountryCode.value = code;
}

function handleComplete(): void {
  const serviceSlug = currentService.value?.slug;
  if (!serviceSlug || !selectedPlanId.value) return;
  submitError.value = "";
  try {
    saveMyPlan(serviceSlug, selectedPlanId.value, services.value, selectedCountryCode.value);
    emit("complete");
  } catch (e: unknown) {
    submitError.value =
      e instanceof Error ? e.message : "요금제 저장 중 오류가 발생했습니다.";
  }
}

function handleLater(): void {
  emit("later");
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    handleLater();
  }
}

onMounted(async () => {
  if (typeof document !== "undefined") {
    document.body.style.overflow = "hidden";
  }
  if (typeof window !== "undefined") {
    window.addEventListener("keydown", onKeydown);
  }

  await loadServices();
  selectedPlanId.value = selectedPlan.value;
  selectedCountryCode.value = selectedCountry.value || "KR";
});

onUnmounted(() => {
  if (typeof document !== "undefined") {
    document.body.style.overflow = "";
  }
  if (typeof window !== "undefined") {
    window.removeEventListener("keydown", onKeydown);
  }
});
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[80] flex items-center justify-center" @click.self="handleLater">
      <div class="absolute inset-0 bg-black/60" @click="handleLater" />
      <div
        class="plan-modal relative z-10 mx-4 max-h-[80vh] w-full max-w-md overflow-hidden border border-border sm:max-w-lg retro-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="my-plan-modal-title"
      >
        <!-- 헤더 -->
        <div class="retro-titlebar flex items-center justify-between">
          <h2 id="my-plan-modal-title" class="retro-title !text-[1rem]">내 요금제 설정</h2>
          <button class="retro-kbd text-xs" aria-label="내 요금제 설정 닫기" @click="handleLater">ESC</button>
        </div>

        <!-- 스텝 인디케이터 -->
        <div class="plan-modal__steps flex items-center gap-0 px-5 pb-2 pt-4">
          <button
            class="flex items-center gap-1.5 text-xs font-semibold transition-colors"
            :class="step === 1 ? 'text-primary' : 'text-muted-foreground'"
            @click="goToStep1"
          >
            <span
              class="plan-modal__step-number flex h-5 w-5 items-center justify-center rounded-full border text-[0.65rem] font-bold leading-none transition-colors"
              :class="step === 1 ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40 bg-muted/30 text-muted-foreground'"
            >1</span>
            <span>요금제</span>
          </button>
          <div class="flex-1 h-px mx-3" :class="step >= 2 ? 'bg-primary/50' : 'bg-border'" />
          <span
            class="flex items-center gap-1.5 text-xs font-semibold"
            :class="step === 2 ? 'text-primary' : 'text-muted-foreground'"
          >
            <span
              class="plan-modal__step-number flex h-5 w-5 items-center justify-center rounded-full border text-[0.65rem] font-bold leading-none transition-colors"
              :class="step === 2 ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/50 bg-muted/20 text-muted-foreground'"
            >2</span>
            <span>국가</span>
          </span>
        </div>

        <!-- 본문 -->
        <div class="plan-modal__body max-h-[calc(80vh-8rem)] overflow-y-auto p-4">
          <LoadingSpinner v-if="loading" message="서비스 목록을 불러오는 중..." />

          <div v-else-if="error" class="rounded border border-destructive/40 bg-destructive/5 p-4">
            <p class="text-xs text-destructive">{{ error }}</p>
          </div>

          <!-- Step 1: 요금제 선택 -->
          <div v-else-if="step === 1">
            <p class="text-sm text-muted-foreground mb-4">
              YouTube Premium 요금제를 선택해 주세요.
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                v-for="plan in availablePlans"
                :key="plan.id"
                type="button"
                class="rounded-md border px-3 py-3 text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
                :class="selectedPlanId === plan.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border/60 bg-card text-foreground hover:border-primary/50'"
                @click="handleSelectPlan(plan.id)"
              >
                <p class="text-xs font-semibold">{{ plan.name }}</p>
                <p v-if="plan.nameEn" class="mt-0.5 text-xs text-muted-foreground">
                  {{ plan.nameEn }}
                </p>
              </button>
            </div>
          </div>

          <!-- Step 2: 국가 선택 -->
          <div v-else-if="step === 2">
            <p class="text-sm text-muted-foreground mb-4">구독 중인 국가를 선택해 주세요.</p>
            <div class="plan-modal__countries grid grid-cols-3 gap-2.5 sm:grid-cols-5">
              <button
                v-for="c in COUNTRIES"
                :key="c.code"
                type="button"
                class="flex flex-col items-center gap-1.5 rounded-md border px-2 py-3 text-center transition-all hover:scale-[1.03] active:scale-[0.97]"
                :class="selectedCountryCode === c.code
                  ? 'border-primary bg-primary/10'
                  : 'border-border/60 hover:border-primary/50'"
                @click="handleSelectCountry(c.code)"
              >
                <span class="text-[1.75rem] leading-none">{{ countryFlag(c.code) }}</span>
                <span class="text-xs font-semibold leading-tight truncate w-full">{{ c.name }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 하단 버튼 -->
        <div class="plan-modal__footer flex items-center justify-between border-t border-border/60 px-4 py-3">
          <p v-if="submitError" class="text-xs text-destructive">{{ submitError }}</p>
          <span v-else />
          <div class="flex items-center gap-2">
            <button type="button" class="retro-kbd text-xs" @click="handleLater">
              나중에 하기
            </button>
            <button
              v-if="step === 1"
              type="button"
              class="retro-kbd text-xs font-semibold"
              :class="canGoStep2 ? 'text-primary border-primary/50 hover:bg-primary/10' : 'opacity-40'"
              :disabled="!canGoStep2"
              @click="goToStep2"
            >
              다음 →
            </button>
            <button
              v-else
              type="button"
              class="retro-kbd text-xs font-semibold text-primary border-primary/50 hover:bg-primary/10"
              @click="handleComplete"
            >
              선택 완료
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

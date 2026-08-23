<script setup lang="ts">
import { computed, watch, onUnmounted, ref } from "vue";
import { useCountryVote } from "@/composables/useCountryVote";
import { countryFlag } from "@/lib/utils";
import { toRef } from "vue";

const props = defineProps<{
  show: boolean;
  serviceSlug: string;
  countries: { countryCode: string; country: string }[];
}>();

const emit = defineEmits<{ close: [] }>();

const slugRef = toRef(props, "serviceSlug");
const {
  sortedResults,
  totalVotes,
  maxVoteCount,
  hasVoted,
  votedCountry,
  loading,
  voting,
  error,
  vote,
  loadResults,
} = useCountryVote(slugRef);

const isRevoting = ref(false);

// 모달 열릴 때 결과 로드 + ESC 키 이벤트 통합 관리
function onKeydown(e: KeyboardEvent): void {
  if (e.key === "Escape") emit("close");
}

watch(
  () => props.show,
  async (open) => {
    if (open) {
      isRevoting.value = false;
      window.addEventListener("keydown", onKeydown);
      try {
        await loadResults();
      } catch {
        // error ref는 useCountryVote 내부에서 처리됨
      }
    } else {
      window.removeEventListener("keydown", onKeydown);
    }
  }
);

// 모달이 열린 채로 unmount될 경우 안전망
onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown);
});

// 상위 10개만 표시
const top10Results = computed(() => sortedResults.value.slice(0, 10));

function voteBarWidth(voteCount: number): string {
  if (!maxVoteCount.value || maxVoteCount.value <= 0) return "0%";
  return `${Math.max(4, Math.round((voteCount / maxVoteCount.value) * 100))}%`;
}

function votePercent(voteCount: number): string {
  if (!totalVotes.value || totalVotes.value <= 0) return "0%";
  return `${Math.round((voteCount / totalVotes.value) * 100)}%`;
}

// countries prop에서 나라명 조회 (API 결과에 country가 없을 때 fallback)
const countryNameMap = computed(() => {
  const map = new Map<string, string>();
  for (const c of props.countries) {
    map.set(c.countryCode.toUpperCase(), c.country);
  }
  return map;
});

function resolveCountryName(item: { countryCode: string; country?: string }): string {
  if (item.country) return item.country;
  return countryNameMap.value.get(item.countryCode.toUpperCase()) || item.countryCode;
}

async function handleVote(countryCode: string): Promise<void> {
  const success = await vote(countryCode, { allowRevote: isRevoting.value });
  if (success) {
    isRevoting.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="props.show"
        class="fixed inset-0 z-50 flex items-center justify-center"
      >
        <div class="absolute inset-0 bg-black/60" @click="emit('close')" />
        <div class="relative z-10 w-full max-w-md sm:max-w-lg mx-4 max-h-[80vh] overflow-hidden retro-panel border border-border">
          <div class="retro-titlebar flex items-center justify-between">
            <h3 class="retro-title !text-[1rem]">YouTube Premium 최적 국가 투표</h3>
            <button class="retro-kbd text-xs" @click="emit('close')">ESC</button>
          </div>

          <div class="p-4 overflow-y-auto max-h-[calc(80vh-3rem)]">
            <!-- 로딩 -->
            <p v-if="loading" class="text-center text-sm text-muted-foreground py-4">
              불러오는 중...
            </p>

            <!-- 투표 전: 국가 그리드 (API 에러 시에도 투표 가능하도록) -->
            <div v-else-if="!hasVoted || isRevoting">
              <p v-if="error" class="text-xs text-destructive mb-2">{{ error }}</p>
              <p class="text-sm text-muted-foreground mb-4">
                가장 구독하기 좋다고 생각하는 국가에 투표해 주세요.
              </p>
              <p v-if="isRevoting" class="text-xs text-muted-foreground mb-3">
                재투표 시 기존 선택이 새 국가로 변경됩니다.
              </p>
              <div class="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                <button
                  v-for="c in countries"
                  :key="c.countryCode"
                  class="flex flex-col items-center gap-1.5 rounded-md border border-border/60 px-2 py-3 text-center transition-all hover:border-primary/70 hover:bg-accent/60 hover:scale-[1.03] active:scale-[0.97] active:bg-accent disabled:opacity-50"
                  :disabled="voting"
                  @click="handleVote(c.countryCode)"
                >
                  <span class="text-[1.75rem] leading-none">{{ countryFlag(c.countryCode) }}</span>
                  <span class="text-xs font-semibold leading-tight truncate w-full">{{ c.country }}</span>
                </button>
              </div>
              <div v-if="isRevoting" class="mt-4 flex justify-end">
                <button
                  type="button"
                  class="retro-kbd text-xs"
                  :disabled="voting"
                  @click="isRevoting = false"
                >
                  결과로 돌아가기
                </button>
              </div>
            </div>

            <!-- 투표 후: 바 차트 결과 -->
            <div v-else>
              <p v-if="error" class="text-xs text-destructive mb-2">{{ error }}</p>
              <p class="text-sm text-muted-foreground mb-4">
                총 <strong class="text-foreground">{{ totalVotes }}</strong>명 투표
              </p>
              <ul class="space-y-3">
                <!-- 투표한 국가의 강조 배경은 bg-primary/8이었다. /8은 Tailwind opacity
                     스케일 밖이라 규칙이 아예 생성되지 않아 배경이 칠해진 적이 없다.
                     스케일 밖 값은 임의값 문법으로 적어야 CSS가 나온다. -->
                <li
                  v-for="(item, idx) in top10Results"
                  :key="item.countryCode"
                  class="rounded-md px-3 py-2.5 transition-colors"
                  :class="item.countryCode === votedCountry ? 'bg-primary/[8%] border border-primary/30' : 'border border-transparent'"
                >
                  <div class="flex items-center justify-between mb-1.5">
                    <span class="flex items-center gap-2.5 font-semibold text-sm">
                      <span class="text-[1.5rem] leading-none">{{ countryFlag(item.countryCode) }}</span>
                      <span>{{ resolveCountryName(item) }}</span>
                      <span
                        v-if="item.countryCode === votedCountry"
                        class="text-[0.65rem] text-primary font-bold border border-primary/40 rounded px-1 py-0.5 leading-none"
                      >MY</span>
                    </span>
                    <span class="flex items-center gap-2 text-xs">
                      <span class="tabular-nums font-medium text-muted-foreground">{{ item.voteCount }}표</span>
                      <span class="tabular-nums font-semibold text-foreground w-10 text-right">{{ votePercent(item.voteCount) }}</span>
                    </span>
                  </div>
                  <div class="h-5 w-full rounded bg-muted/40 overflow-hidden">
                    <div
                      class="h-full rounded transition-all duration-500 flex items-center justify-end pr-1.5"
                      :class="item.countryCode === votedCountry ? 'bg-primary' : 'bg-primary/40'"
                      :style="{ width: voteBarWidth(item.voteCount) }"
                    >
                      <span
                        v-if="idx < 3 && item.voteCount > 0"
                        class="text-[0.6rem] font-bold leading-none"
                        :class="item.countryCode === votedCountry ? 'text-primary-foreground' : 'text-primary'"
                      >{{ idx + 1 }}</span>
                    </div>
                  </div>
                </li>
              </ul>
              <div class="mt-4 flex justify-end">
                <button
                  type="button"
                  class="retro-kbd text-xs"
                  :disabled="voting"
                  @click="isRevoting = true"
                >
                  재투표하기
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>

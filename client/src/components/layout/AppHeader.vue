<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { Moon, Sun } from "lucide-vue-next";
import {
  ShButton,
  ShPrimaryNavigation,
  type PrimaryNavigationItem,
} from "@shakilabs/ui";
import { useHeadlineMessages } from "@/composables/useHeadlineMessages";

const emit = defineEmits<{
  (event: "openMyPlan"): void;
}>();

const route = useRoute();
const router = useRouter();

const SERVICE_SLUG = "youtube-premium";

const sectionHashes = {
  compare: "#compare",
  ranking: "#ranking",
  faq: "#faq",
} as const;

const navigationItems: readonly PrimaryNavigationItem[] = [
  { key: "compare", label: "글로벌 가격 비교", to: "#compare", action: true },
  { key: "ranking", label: "글로벌 랭킹", to: "#ranking", action: true },
  { key: "faq", label: "자주 묻는 질문", to: "#faq", action: true },
  { key: "community", label: "커뮤니티", to: "/community" },
  {
    key: "plan",
    label: "내 기준 설정",
    to: "#plan",
    action: true,
    ariaHaspopup: "dialog",
  },
];

const selectedSection = ref<keyof typeof sectionHashes>("compare");
const activeNavigationKey = computed(() => {
  if (route.path.startsWith("/community")) return "community";
  if (route.path === `/${SERVICE_SLUG}`) return selectedSection.value;
  return "";
});

// 사전에 정의된 해시만 querySelector에 전달한다.
const ALLOWED_HASHES = new Set<string>(Object.values(sectionHashes));

function scrollToHash(hash: string): void {
  if (!ALLOWED_HASHES.has(hash)) return;
  const el = document.querySelector(hash);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function handleAnchorClick(hash: string): Promise<void> {
  if (route.path === `/${SERVICE_SLUG}`) {
    scrollToHash(hash);
  } else {
    await router.push(`/${SERVICE_SLUG}`);
    await nextTick();
    setTimeout(() => scrollToHash(hash), 150);
  }
}

async function handlePrimaryNavigation(item: PrimaryNavigationItem): Promise<void> {
  if (item.key === "plan") {
    emit("openMyPlan");
    return;
  }

  const sectionKey = item.key as keyof typeof sectionHashes;
  const hash = sectionHashes[sectionKey];
  if (!hash) return;

  selectedSection.value = sectionKey;
  await handleAnchorClick(hash);
}

// 가격 데이터가 없을 때 보여줄 정적 fallback 메시지
const FALLBACK_MESSAGES = [
  "국가별 구독료를 한눈에 비교하세요",
  "현재 환율 기준 최저가 국가 랭킹",
  "해외 결제로 구독료를 절약하세요",
];

const { messages: dynamicMessages } = useHeadlineMessages();
const currentHeadlineIndex = ref(0);
let headlineTicker: ReturnType<typeof setInterval> | null = null;

// 동적 메시지가 있으면 사용, 없으면 fallback
const activeMessages = computed(() =>
  dynamicMessages.value.length > 0 ? dynamicMessages.value : FALLBACK_MESSAGES
);

const currentHeadline = computed(
  () => activeMessages.value[currentHeadlineIndex.value % activeMessages.value.length]
);

const THEME_STORAGE_KEY = "ottwatcher:theme:v1";
type ThemeMode = "light" | "dark";
const theme = ref<ThemeMode>("light");

function rotateHeadline(): void {
  currentHeadlineIndex.value =
    (currentHeadlineIndex.value + 1) % activeMessages.value.length;
}

function applyTheme(next: ThemeMode): void {
  theme.value = next;
  const root = document.documentElement;
  root.classList.toggle("dark", next === "dark");
  localStorage.setItem(THEME_STORAGE_KEY, next);
}

function toggleTheme(): void {
  applyTheme(theme.value === "dark" ? "light" : "dark");
}

onMounted(() => {
  theme.value = document.documentElement.classList.contains("dark")
    ? "dark"
    : "light";

  // 4000ms: transition 300ms×2 = 600ms 제외 시 실독 시간 ≈ 3.4s
  headlineTicker = setInterval(rotateHeadline, 4000);
});

onUnmounted(() => {
  if (headlineTicker) {
    clearInterval(headlineTicker);
  }
});
</script>

<template>
  <header class="border-b border-border bg-background">
    <div class="container pt-2.5 pb-2.5">
      <div class="overflow-hidden">
        <div class="retro-titlebar h-11 border-b-0 px-2 bg-transparent">
          <div class="flex h-full w-full items-center gap-4">
            <a
              href="/ott"
              aria-label="ShakiLabs 홈"
              class="inline-flex h-8 w-8 sm:w-auto shrink-0 items-center justify-center sm:justify-start gap-1.5 px-0.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <span
                class="inline-flex h-6 w-6 items-center justify-center rounded-md bg-muted/60 ring-1 ring-border/60"
                aria-hidden="true"
              >
                <img src="/logo.png" alt="" class="h-4 w-4 shrink-0" />
              </span>
              <span class="hidden sm:inline font-title text-tiny tracking-wide text-foreground/90">
                ShakiLabs
              </span>
            </a>
            <div class="flex h-full flex-1 items-center justify-center text-center font-title text-caption sm:text-body overflow-hidden">
              <Transition name="headline-fade" mode="out-in">
                <span
                  :key="currentHeadline"
                  class="block w-full truncate text-center"
                >
                  {{ currentHeadline }}
                </span>
              </Transition>
            </div>
            <ShButton
              type="button"
              variant="secondary"
              size="sm"
              class="design-system-theme-toggle shrink-0 text-muted-foreground"
              :aria-label="theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'"
              @click="toggleTheme"
            >
              <Moon v-if="theme === 'dark'" class="h-4 w-4" />
              <Sun v-else class="h-4 w-4" />
            </ShButton>
          </div>
        </div>
      </div>
    </div>
  </header>

  <ShPrimaryNavigation
    :items="navigationItems"
    :active-key="activeNavigationKey"
    :link-component="RouterLink"
    aria-label="섹션 이동"
    @select="handlePrimaryNavigation"
  />
</template>

<style scoped>
/* 스톡 티커 느낌: 위로 스크롤되며 다음 메시지 등장 */
.headline-fade-enter-active,
.headline-fade-leave-active {
  transition: transform 0.3s ease;
}

.headline-fade-enter-from {
  transform: translateY(10px);
}

.headline-fade-leave-to {
  transform: translateY(-10px);
}
</style>

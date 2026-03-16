<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { showAlert } from "@/composables/useAlert";
import { useMyPlan } from "@/composables/useMyPlan";
import { formatNumber, countryFlag } from "@/lib/utils";
import { DEFAULT_SITE_URL } from "@/lib/site";
import { Card, CardContent } from "@/components/ui/card";
import { Share2 } from "lucide-vue-next";
import ShareModal from "@/components/share/ShareModal.vue";
import type { PricesResponse } from "@/api";

type ComparePriceRow = {
  countryCode: string;
  country: string;
  currency: string | null;
  localMonthly: number | null;
  krw: number | null;
  usd: number | null;
};

type ShareRow = { countryCode: string; country: string; krw: number | null };

const props = defineProps<{
  priceData: PricesResponse;
  selectedPlan: string;
  selectedPlanLabel: string;
  serviceName: string;
  serviceSlug: string;
  comparePriceRows: ComparePriceRow[];
}>();

type KakaoSharePayload = {
  objectType: "feed";
  content: {
    title: string;
    description: string;
    imageUrl: string;
    imageWidth: number;
    imageHeight: number;
    link: { mobileWebUrl: string; webUrl: string };
  };
  buttonTitle?: string;
};

type KakaoWindow = Window & {
  Kakao?: {
    isInitialized: () => boolean;
    init: (key: string) => void;
    Share: { sendDefault: (opts: KakaoSharePayload) => void };
  };
  __kakaoSdkLoading?: Promise<void>;
};

const KAKAO_SDK_URL =
  ((import.meta.env as Record<string, string>).VITE_KAKAO_SDK_URL || "https://t1.kakaocdn.net/kakao_js_sdk/2.7.7/kakao.min.js").trim();
const KAKAO_SDK_DEFAULT_URL = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.7/kakao.min.js";
const KAKAO_SDK_DEFAULT_INTEGRITY = "sha384-tJkjbtDbvoxO+diRuDtwRO9JXR7pjWnfjfRn5ePUpl7e7RJCxKCwwnfqUAdXh53p";
const KAKAO_DESC_MAX_CHARS = 140;
const KAKAO_TITLE_MAX_CHARS = 48;
const KAKAO_PAYLOAD_SOFT_LIMIT = 9_000;
const KAKAO_PAYLOAD_HARD_LIMIT = 9_800;

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function fmtKrw(val: number | null | undefined): string {
  if (val == null) return "-";
  return `${formatNumber(Math.round(val))}원`;
}

function fmtUsd(val: number | null | undefined): string {
  if (val == null) return "-";
  return `$${val.toFixed(2)}`;
}

function fmtLocalPrice(value: number | null | undefined, currency: string | null | undefined): string {
  if (value == null) return "-";
  const formatted = new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
  return currency ? `${formatted} ${currency}` : formatted;
}

// 국가 선택 상태
const selectedCompareCountryCode = ref("");
const showCountryModal = ref(false);
const { selectedCountry: myCountry, hasChosen: myPlanChosen } = useMyPlan();
const selectedRightCountryCode = ref("KR");
const showRightCountryModal = ref(false);

// useMyPlan hydration 완료 시 국가 동기화
watch(
  [myPlanChosen, myCountry],
  ([chosen, code]) => {
    if (chosen && code) {
      selectedRightCountryCode.value = code;
    }
  },
  { immediate: true }
);

function selectCountry(code: string) {
  selectedCompareCountryCode.value = code;
  showCountryModal.value = false;
}

function selectRightCountry(code: string) {
  selectedRightCountryCode.value = code;
  showRightCountryModal.value = false;
}

const rightCompareRow = computed<ComparePriceRow | null>(() =>
  props.comparePriceRows.find((row) => row.countryCode === selectedRightCountryCode.value) || null
);

const selectableCompareRows = computed<ComparePriceRow[]>(() =>
  props.comparePriceRows
    .filter((row) => row.countryCode !== selectedRightCountryCode.value && row.krw != null)
    .sort((a, b) => (a.krw ?? Number.POSITIVE_INFINITY) - (b.krw ?? Number.POSITIVE_INFINITY))
);

const selectableRightRows = computed<ComparePriceRow[]>(() =>
  props.comparePriceRows
    .filter((row) => row.countryCode !== selectedCompareCountryCode.value && row.krw != null)
    .sort((a, b) => (a.krw ?? Number.POSITIVE_INFINITY) - (b.krw ?? Number.POSITIVE_INFINITY))
);

const selectedCompareCountry = computed<ComparePriceRow | null>(() =>
  selectableCompareRows.value.find((row) => row.countryCode === selectedCompareCountryCode.value)
  || selectableCompareRows.value[0]
  || null
);

// 초기 좌측 국가 자동 선택
watch(
  selectableCompareRows,
  (rows) => {
    if (!rows.length) {
      selectedCompareCountryCode.value = "";
      return;
    }
    const hasSelected = rows.some((row) => row.countryCode === selectedCompareCountryCode.value);
    if (!hasSelected) {
      selectedCompareCountryCode.value = rows[0].countryCode;
    }
  },
  { immediate: true }
);

const compareSavingsPercent = computed<number | null>(() => {
  const leftKrw = selectedCompareCountry.value?.krw ?? null;
  const rightKrw = rightCompareRow.value?.krw ?? null;
  if (leftKrw == null || rightKrw == null || rightKrw <= 0) return null;
  return Math.round(((rightKrw - leftKrw) / rightKrw) * 100);
});

const compareSavingsAmount = computed<number>(() => {
  const leftKrw = selectedCompareCountry.value?.krw ?? null;
  const rightKrw = rightCompareRow.value?.krw ?? null;
  if (leftKrw == null || rightKrw == null) return 0;
  return Math.round(Math.abs(rightKrw - leftKrw));
});

// 한국어 받침 유무로 조사 선택: "한국이/튀르키예가", "한국으로/튀르키예로"
function particle(name: string, withBatchim: string, withoutBatchim: string): string {
  const last = name.charCodeAt(name.length - 1);
  const hasBatchim = last >= 0xAC00 && last <= 0xD7A3 && (last - 0xAC00) % 28 !== 0;
  return `${name}${hasBatchim ? withBatchim : withoutBatchim}`;
}

const compareSummary = computed<{ message: string; tone: string } | null>(() => {
  const left = selectedCompareCountry.value;
  const right = rightCompareRow.value;
  const diff = compareSavingsPercent.value;
  const amt = compareSavingsAmount.value;
  if (!left || !right || diff == null) return null;

  const leftGa = particle(left.country, "이", "가");
  const rightI = particle(right.country, "이", "가");
  const rightEuro = particle(right.country, "으로", "로");

  if (diff >= 60) return { message: `${leftGa} ${diff}% 저렴해요. 월 ${fmtKrw(amt)} 차이 — 같은 서비스인데 가격이 다른 세계`, tone: "text-savings" };
  if (diff >= 20) return { message: `${leftGa} ${diff}% 저렴해요. 매달 ${fmtKrw(amt)}씩 절약 가능`, tone: "text-savings" };
  if (diff > 0) return { message: `${leftGa} ${diff}% 저렴하지만 월 ${fmtKrw(amt)} 차이. 환율에 따라 달라질 수 있어요`, tone: "text-savings" };
  if (diff === 0) return { message: `두 나라 요금이 똑같아요. 드문 경우!`, tone: "text-muted-foreground" };

  const absDiff = Math.abs(diff);
  if (absDiff >= 60) return { message: `${leftGa} ${absDiff}% 비싸요. 월 ${fmtKrw(amt)} 더 내는 셈 — ${rightI} 훨씬 유리해요`, tone: "text-destructive" };
  if (absDiff >= 20) return { message: `${leftGa} ${absDiff}% 비싸네요. ${rightEuro} 월 ${fmtKrw(amt)} 절약 가능`, tone: "text-destructive" };
  return { message: `${leftGa} ${absDiff}% 비싸요. 월 ${fmtKrw(amt)} 차이. 환율 변동에 따라 달라질 수 있어요`, tone: "text-destructive" };
});

// ─── 공유 ─────────────────────────────────────────────────
const kakaoBusy = ref(false);
const showShareModal = ref(false);

type SummaryPriceRow = { countryCode: string; country: string; krw: number; usd: number | null };

const summaryPriceRows = computed<SummaryPriceRow[]>(() => {
  if (!props.priceData?.prices) return [];
  return props.priceData.prices
    .map((country) => {
      const krw = toNumber(country.converted?.[props.selectedPlan]?.krw);
      if (krw == null) return null;
      const usd = toNumber(country.converted?.[props.selectedPlan]?.usd);
      return {
        countryCode: country.countryCode,
        country: typeof country.country === "string" ? country.country : country.countryCode,
        krw,
        usd,
      };
    })
    .filter((row): row is SummaryPriceRow => row !== null);
});

const shareTop3Rows = computed<ShareRow[]>(() =>
  [...summaryPriceRows.value]
    .sort((a, b) => a.krw - b.krw)
    .slice(0, 3)
    .map((r) => ({ countryCode: r.countryCode, country: r.country, krw: r.krw }))
);

function truncateText(value: string, maxChars: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, Math.max(1, maxChars - 1)).trim()}…`;
}

function payloadByteLength(payload: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(payload)).length;
  } catch {
    return JSON.stringify(payload).length * 2;
  }
}

async function ensureKakaoSdkLoaded(w: KakaoWindow): Promise<void> {
  if (w.Kakao) return;
  if (!w.__kakaoSdkLoading) {
    w.__kakaoSdkLoading = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>("script[data-kakao-sdk='true']");
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Kakao SDK 로드 실패")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = KAKAO_SDK_URL;
      script.async = true;
      script.setAttribute("data-kakao-sdk", "true");
      if (KAKAO_SDK_URL === KAKAO_SDK_DEFAULT_URL) {
        script.integrity = KAKAO_SDK_DEFAULT_INTEGRITY;
        script.crossOrigin = "anonymous";
      }
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Kakao SDK 로드 실패"));
      document.head.appendChild(script);
    });
  }

  await w.__kakaoSdkLoading;
  if (!w.Kakao) throw new Error("Kakao SDK 초기화 객체를 찾지 못했습니다.");
}

function resolveSharePageUrl(): string {
  const rawSlug = typeof props.serviceSlug === "string" ? props.serviceSlug.trim() : "";
  const slug = rawSlug || "youtube-premium";
  try {
    return new URL(`/${slug}`, DEFAULT_SITE_URL).toString();
  } catch {
    return `${DEFAULT_SITE_URL}/youtube-premium`;
  }
}

const sharePageUrl = computed(() => resolveSharePageUrl());
// 카카오 공유는 항상 랭킹 이미지 고정 — 비교 상태는 경우의 수가 많아 동적 생성 불가
const shareImageUrl = computed(() => {
  const rawSlug = typeof props.serviceSlug === "string" ? props.serviceSlug.trim() : "";
  const slug = rawSlug || "youtube-premium";
  return `${DEFAULT_SITE_URL}/og/v2/${slug}.png`;
});
const shareTitle = computed(() => `${props.serviceName} 글로벌 랭킹`);

async function onShareKakao(): Promise<void> {
  if (kakaoBusy.value) return;
  kakaoBusy.value = true;
  try {
    const env = import.meta.env as Record<string, string>;
    const kakaoKey = env.VITE_KAKAO_JS_KEY || env.VITE_KAKAO_JAVASCRIPT_KEY;
    if (!kakaoKey) { showAlert("카카오 공유 설정이 없습니다.", { type: "error" }); return; }
    const w = window as KakaoWindow;
    await ensureKakaoSdkLoaded(w);
    const Kakao = w.Kakao;
    if (!Kakao) throw new Error("Kakao SDK 초기화 객체를 찾지 못했습니다.");
    if (!Kakao.isInitialized()) Kakao.init(kakaoKey);

    const cheapest = shareTop3Rows.value[0];
    const savings = compareSavingsPercent.value;
    const siteDomain = new URL(sharePageUrl.value).hostname;
    const descBase = cheapest
      ? `최저가: ${cheapest.country} ${fmtKrw(cheapest.krw)}/월${savings != null && savings > 0 ? ` (${savings}% 절약)` : ""}`
      : `${props.serviceName} 국가별 가격을 비교해보세요`;
    const payload: KakaoSharePayload = {
      objectType: "feed",
      content: {
        title: truncateText(shareTitle.value, KAKAO_TITLE_MAX_CHARS),
        description: truncateText(`${descBase} · ${siteDomain}`, KAKAO_DESC_MAX_CHARS),
        imageUrl: shareImageUrl.value,
        imageWidth: 800,
        imageHeight: 400,
        link: { mobileWebUrl: sharePageUrl.value, webUrl: sharePageUrl.value },
      },
      buttonTitle: "웹으로 보기",
    };

    const payloadSize = payloadByteLength(payload);
    if (payloadSize > KAKAO_PAYLOAD_SOFT_LIMIT) {
      payload.content.description = truncateText(descBase, 90);
    }

    if (payloadByteLength(payload) > KAKAO_PAYLOAD_HARD_LIMIT) {
      showAlert("공유 문구가 길어 카카오 공유를 진행할 수 없습니다. 링크 복사를 이용해 주세요.", { type: "error" });
      return;
    }

    Kakao.Share.sendDefault(payload);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return;
    showAlert(error instanceof Error ? error.message : "카카오 공유에 실패했습니다.", { type: "error" });
  } finally {
    kakaoBusy.value = false;
  }
}

async function onCopyShareLink(): Promise<void> {
  try {
    await navigator.clipboard.writeText(sharePageUrl.value);
    showAlert("링크를 복사했습니다.", { type: "success" });
  } catch {
    showAlert("링크 복사에 실패했습니다.", { type: "error" });
  }
}

// 부모에게 우측 카드 기준 국가 코드를 알려줌
defineExpose({ selectedRightCountryCode });
</script>

<template>
  <Card id="compare" class="mb-4 retro-panel overflow-hidden">
    <div class="retro-titlebar">
      <h2 class="retro-title">YouTube Premium 글로벌 가격 비교</h2>
    </div>
    <CardContent class="space-y-4">
      <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_56px_minmax(0,1fr)] md:items-stretch">
        <!-- 좌측 -->
        <button
          class="group retro-panel-muted p-4 flex h-full min-h-[180px] flex-col text-left border border-border/40 hover:border-primary/60 transition-all hover:shadow-sm"
          @click="showCountryModal = true"
        >
          <div v-if="selectedCompareCountry" class="w-full h-full flex flex-col justify-between gap-3">
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-3 min-w-0">
                <span class="text-[2.8rem] leading-none shrink-0">{{ countryFlag(selectedCompareCountry.countryCode) }}</span>
                <div class="min-w-0">
                  <p class="text-body font-black leading-tight truncate">{{ selectedCompareCountry.country }}</p>
                  <p class="text-tiny text-muted-foreground mt-0.5">{{ selectedPlanLabel }} 요금제</p>
                </div>
              </div>
              <span class="retro-kbd uppercase tracking-wide group-hover:text-primary shrink-0">선택</span>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div class="bg-background/60 border border-border/40 rounded px-2.5 py-2">
                <p class="text-[0.6rem] uppercase tracking-wider text-muted-foreground font-medium">현지 요금</p>
                <p class="text-caption font-bold mt-1 tabular-nums">{{ fmtUsd(selectedCompareCountry.usd) }}</p>
                <p class="mt-0.5 text-[0.6rem] leading-tight text-muted-foreground/70">{{ fmtLocalPrice(selectedCompareCountry.localMonthly, selectedCompareCountry.currency) }}</p>
              </div>
              <div class="bg-background/60 border border-border/40 rounded px-2.5 py-2">
                <p class="text-[0.6rem] uppercase tracking-wider text-muted-foreground font-medium">원화 환산</p>
                <p class="text-caption font-bold mt-1 tabular-nums">{{ fmtKrw(selectedCompareCountry.krw) }}</p>
              </div>
            </div>
          </div>
          <p v-else class="text-caption text-muted-foreground">비교 가능한 국가 데이터가 없습니다.</p>
        </button>

        <!-- VS 표시 (모바일 + 데스크톱) -->
        <div class="flex md:hidden items-center justify-center -my-1">
          <div class="h-px flex-1 bg-border/50" />
          <span class="retro-kbd px-3 py-1 font-extrabold text-foreground border-primary/50 mx-3">VS</span>
          <div class="h-px flex-1 bg-border/50" />
        </div>
        <div class="hidden md:flex items-center justify-center">
          <span class="retro-kbd px-3 py-1 font-extrabold text-foreground border-primary/50">VS</span>
        </div>

        <!-- 우측 -->
        <button
          class="group retro-panel-muted p-4 flex h-full min-h-[180px] flex-col text-left border border-border/40 hover:border-primary/60 transition-all hover:shadow-sm"
          @click="showRightCountryModal = true"
        >
          <div v-if="rightCompareRow" class="w-full h-full flex flex-col justify-between gap-3">
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-3 min-w-0">
                <span class="text-[2.8rem] leading-none shrink-0">{{ countryFlag(rightCompareRow.countryCode) }}</span>
                <div class="min-w-0">
                  <p class="text-body font-black leading-tight truncate">{{ rightCompareRow.country }}</p>
                  <p class="text-tiny text-muted-foreground mt-0.5">{{ selectedPlanLabel }} 요금제</p>
                </div>
              </div>
              <div class="shrink-0 flex items-center gap-1.5">
                <span class="retro-kbd tracking-wide group-hover:text-primary">내 요금</span>
                <span class="retro-kbd uppercase tracking-wide group-hover:text-primary">선택</span>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div class="bg-background/60 border border-border/40 rounded px-2.5 py-2">
                <p class="text-[0.6rem] uppercase tracking-wider text-muted-foreground font-medium">현지 요금</p>
                <p class="text-caption font-bold mt-1 tabular-nums">{{ fmtUsd(rightCompareRow.usd) }}</p>
                <p class="mt-0.5 text-[0.6rem] leading-tight text-muted-foreground/70">{{ fmtLocalPrice(rightCompareRow.localMonthly, rightCompareRow.currency) }}</p>
              </div>
              <div class="bg-background/60 border border-border/40 rounded px-2.5 py-2">
                <p class="text-[0.6rem] uppercase tracking-wider text-muted-foreground font-medium">원화 환산</p>
                <p class="text-caption font-bold mt-1 tabular-nums">{{ fmtKrw(rightCompareRow.krw) }}</p>
              </div>
            </div>
          </div>
          <p v-else class="text-caption text-muted-foreground">비교 가능한 국가 데이터가 없습니다.</p>
        </button>
      </div>

      <!-- 좌측 국가 선택 모달 -->
      <Teleport to="body">
        <div v-if="showCountryModal" class="fixed inset-0 z-50 flex items-center justify-center">
          <div class="absolute inset-0 bg-black/60" @click="showCountryModal = false" />
          <div class="relative z-10 w-full max-w-md sm:max-w-2xl mx-4 max-h-[80vh] overflow-hidden retro-panel border border-border">
            <div class="retro-titlebar flex items-center justify-between">
              <h3 class="retro-title !text-[1rem]">비교 국가 선택</h3>
              <button class="retro-kbd text-xs" @click="showCountryModal = false">ESC</button>
            </div>
            <div class="p-4 grid grid-cols-3 sm:grid-cols-5 gap-2.5 max-h-[calc(80vh-3rem)] overflow-y-auto" style="scrollbar-width: thin">
              <button
                v-for="country in selectableCompareRows"
                :key="country.countryCode"
                @click="selectCountry(country.countryCode)"
                class="border rounded-md p-2.5 md:p-3 text-center transition-all retro-panel-muted min-h-[88px] md:min-h-[96px] hover:scale-[1.02] active:scale-[0.98]"
                :class="selectedCompareCountryCode === country.countryCode ? 'border-primary bg-primary/10 shadow-sm' : 'border-border/40 hover:border-primary/50'"
              >
                <div class="text-[1.75rem] md:text-[2rem] leading-none mb-1.5">{{ countryFlag(country.countryCode) }}</div>
                <div class="text-xs font-semibold leading-tight truncate w-full">{{ country.country }}</div>
                <div class="text-xs md:text-caption tabular-nums text-primary font-bold mt-0.5">{{ fmtKrw(country.krw) }}</div>
              </button>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- 우측 국가 선택 모달 -->
      <Teleport to="body">
        <div v-if="showRightCountryModal" class="fixed inset-0 z-50 flex items-center justify-center">
          <div class="absolute inset-0 bg-black/60" @click="showRightCountryModal = false" />
          <div class="relative z-10 w-full max-w-md sm:max-w-2xl mx-4 max-h-[80vh] overflow-hidden retro-panel border border-border">
            <div class="retro-titlebar flex items-center justify-between">
              <h3 class="retro-title !text-[1rem]">기준 국가 선택</h3>
              <button class="retro-kbd text-xs" @click="showRightCountryModal = false">ESC</button>
            </div>
            <div class="p-4 grid grid-cols-3 sm:grid-cols-5 gap-2.5 max-h-[calc(80vh-3rem)] overflow-y-auto" style="scrollbar-width: thin">
              <button
                v-for="country in selectableRightRows"
                :key="country.countryCode"
                @click="selectRightCountry(country.countryCode)"
                class="border rounded-md p-2.5 md:p-3 text-center transition-all retro-panel-muted min-h-[88px] md:min-h-[96px] hover:scale-[1.02] active:scale-[0.98]"
                :class="selectedRightCountryCode === country.countryCode ? 'border-primary bg-primary/10 shadow-sm' : 'border-border/40 hover:border-primary/50'"
              >
                <div class="text-[1.75rem] md:text-[2rem] leading-none mb-1.5">{{ countryFlag(country.countryCode) }}</div>
                <div class="text-xs font-semibold leading-tight truncate w-full">{{ country.country }}</div>
                <div class="text-xs md:text-caption tabular-nums text-primary font-bold mt-0.5">{{ fmtKrw(country.krw) }}</div>
              </button>
            </div>
          </div>
        </div>
      </Teleport>

      <div v-if="compareSummary" class="retro-panel-muted border border-border/50 rounded px-4 py-3">
        <div class="flex items-start gap-2.5">
          <span v-if="compareSavingsPercent != null && compareSavingsPercent > 0" class="text-lg leading-none shrink-0">💡</span>
          <span v-else-if="compareSavingsPercent != null && compareSavingsPercent < 0" class="text-lg leading-none shrink-0">⚠️</span>
          <p class="text-caption leading-relaxed" :class="compareSummary.tone">{{ compareSummary.message }}</p>
        </div>
      </div>

      <!-- 공유하기 버튼 -->
      <div class="flex justify-end">
        <button class="retro-kbd inline-flex items-center gap-1.5 text-tiny hover:text-primary transition-colors" @click="showShareModal = true">
          <Share2 class="h-3.5 w-3.5" />
          공유하기
        </button>
      </div>
    </CardContent>
  </Card>

  <ShareModal
    :show="showShareModal"
    :kakao-busy="kakaoBusy"
    @close="showShareModal = false"
    @share-kakao="onShareKakao()"
    @copy-link="onCopyShareLink()"
  />
</template>

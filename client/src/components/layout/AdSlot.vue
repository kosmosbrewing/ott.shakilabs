<script setup lang="ts">
import { ref, computed, onMounted } from "vue";

type AdPosition = "top" | "middle" | "bottom" | "sidebar";

const props = withDefaults(
  defineProps<{
    position?: AdPosition;
    slot?: string;
    preview?: boolean;
  }>(),
  {
    position: "top",
    slot: "",
    preview: true,
  }
);

const publisherId = (import.meta.env.VITE_ADSENSE_PUBLISHER_ID || "").trim();
const slotMap: Record<AdPosition, string> = {
  top: (import.meta.env.VITE_ADSENSE_SLOT_TOP || "").trim(),
  middle: (import.meta.env.VITE_ADSENSE_SLOT_MIDDLE || "").trim(),
  bottom: (import.meta.env.VITE_ADSENSE_SLOT_BOTTOM || "").trim(),
  sidebar: (import.meta.env.VITE_ADSENSE_SLOT_SIDEBAR || "").trim(),
};
const adRef = ref<HTMLElement | null>(null);

// 위치별 광고 포맷 매핑
const adConfig: Record<AdPosition, { format: string; style: string; height: string }> = {
  top: { format: "horizontal", style: "display:block", height: "h-[90px]" },
  middle: { format: "fluid", style: "display:block; text-align:center", height: "h-[250px]" },
  bottom: { format: "auto", style: "display:block", height: "h-[250px]" },
  sidebar: { format: "vertical", style: "display:block", height: "h-[600px]" },
};
const positionLabelMap: Record<AdPosition, string> = {
  top: "상단 배너",
  middle: "중간 인피드",
  bottom: "하단 배너",
  sidebar: "사이드바",
};

const resolvedSlot = computed(() => {
  if (props.slot && props.slot.trim()) return props.slot.trim();
  return slotMap[props.position] || "";
});

const canRenderRealAd = computed(() => Boolean(publisherId && resolvedSlot.value));
const shouldRenderPreview = computed(() => props.preview && !canRenderRealAd.value);
const positionLabel = computed(() => positionLabelMap[props.position] || "광고");

let adsenseScriptPromise: Promise<void> | null = null;
function ensureAdsenseScript(): Promise<void> {
  const adsWindow = window as Window & { adsbygoogle?: unknown[] };
  if (adsWindow.adsbygoogle) return Promise.resolve();
  if (adsenseScriptPromise) return adsenseScriptPromise;

  adsenseScriptPromise = new Promise((resolve, reject) => {
    // index.html의 정적 로더(data-adsense)도 인식해야 이중 주입을 막는다
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-adsense-loader="true"], script[data-adsense="true"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("AdSense script load failed")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisherId}`;
    script.crossOrigin = "anonymous";
    script.dataset.adsenseLoader = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("AdSense script load failed"));
    document.head.appendChild(script);
  });

  return adsenseScriptPromise;
}

onMounted(() => {
  if (!canRenderRealAd.value) return;

  ensureAdsenseScript()
    .then(() => {
      try {
        if (!adRef.value?.dataset?.adSlot) return;
        const adsWindow = window as Window & { adsbygoogle?: unknown[] };
        (adsWindow.adsbygoogle = adsWindow.adsbygoogle || []).push({});
      } catch {
        // 광고 로드 실패 시 플레이스홀더 유지
      }
    })
    .catch(() => {
      // 광고 스크립트 로드 실패 시 플레이스홀더 유지
    });
});
</script>

<template>
  <div v-if="canRenderRealAd || shouldRenderPreview" class="w-full overflow-hidden">
    <ins
      v-if="canRenderRealAd"
      ref="adRef"
      :class="['adsbygoogle', 'w-full', adConfig[position].height]"
      :style="adConfig[position].style"
      :data-ad-client="publisherId"
      :data-ad-slot="resolvedSlot"
      :data-ad-format="adConfig[position].format"
      data-full-width-responsive="true"
    ></ins>
    <div
      v-else
      :class="[
        'retro-panel-muted flex w-full items-center justify-center border border-dashed border-border/70 bg-muted/20 px-4 text-center',
        adConfig[position].height
      ]"
    >
      <div class="space-y-1">
        <p class="text-caption font-semibold text-foreground/80">
          Google AdSense {{ positionLabel }}
        </p>
        <p class="text-tiny text-muted-foreground">
          {{ resolvedSlot ? `Slot ${resolvedSlot}` : "Slot ID 미설정 (레이아웃 미리보기)" }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 히어로 금액 카운트업 — ott는 VS 비교 카드의 금액 4곳이 인라인이라 값 렌더러 하나로 공통화한다.
// 이 컴포넌트가 앱에서 유일한 카운트업 구현이다(보조 스탯에는 쓰지 않는다).
//
// 정책(2026-08 복원):
// - SSR/SSG 산출물에는 항상 최종값이 정적으로 남는다(초기 ref = props.value,
//   애니메이션은 onMounted 이후에만 시작 → 하이드레이션 불일치 없음).
// - 마운트 시 0→값, props 변경 시 현재 표시값→새 값으로 보간(중단 후 이어가기).
// - prefers-reduced-motion 이면 즉시 최종값. 호출부의 tabular-nums가 폭을 잡는다.
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps<{ value: string }>();

const DURATION_MS = 750;
// 포맷된 문자열("1,234,000원")의 첫 숫자 토큰만 보간 대상으로 삼는다.
const NUM_RE = /-?\d[\d,]*(?:\.\d+)?/;

const displayValue = ref(props.value);
let rafId = 0;

function parseNum(text: string): { num: number; decimals: number } | null {
  const m = text.match(NUM_RE);
  if (!m) return null;
  const raw = m[0].replace(/,/g, "");
  const num = Number(raw);
  if (!Number.isFinite(num)) return null;
  const decimals = raw.includes(".") ? raw.split(".")[1].length : 0;
  return { num, decimals };
}

function formatLike(template: string, n: number, decimals: number): string {
  const grouped = template.match(NUM_RE)?.[0].includes(",") ?? false;
  const formatted = n.toLocaleString("ko-KR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: grouped,
  });
  return template.replace(NUM_RE, formatted);
}

function animateTo(from: number, target: string) {
  cancelAnimationFrame(rafId);
  const parsed = parseNum(target);
  if (
    !parsed ||
    parsed.num === from ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    displayValue.value = target;
    return;
  }
  const start = performance.now();
  const delta = parsed.num - from;
  const tick = (now: number) => {
    const t = Math.min((now - start) / DURATION_MS, 1);
    if (t >= 1) {
      displayValue.value = target;
      return;
    }
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    displayValue.value = formatLike(target, from + delta * eased, parsed.decimals);
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

onMounted(() => {
  animateTo(0, props.value);
  watch(
    () => props.value,
    (next) => {
      const current = parseNum(displayValue.value)?.num ?? 0;
      animateTo(current, next);
    },
  );
});

onBeforeUnmount(() => cancelAnimationFrame(rafId));
</script>

<template>
  <span>{{ displayValue }}</span>
</template>

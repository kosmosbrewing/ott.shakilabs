<script setup lang="ts">
/**
 * 프리렌더 정적 HTML과 "같은 문구"를 화면에도 렌더한다.
 *
 * 배경: 하이드레이션 시 removePrerenderFallback()이 body의 프리렌더 블록을 제거한다.
 * 그 제거가 안전하려면 프리렌더가 뷰 출력의 사본이어야 하는데, 콘텐츠를 프리렌더
 * 스크립트에만 넣으면 JS를 켠 사용자와 렌더링 크롤러에게서 본문이 사라진다
 * (= 크롤러에게만 보이는 은닉 텍스트/클로킹). 그래서 문구를 scripts/seo-content.mjs
 * 한 곳에 두고 프리렌더와 이 컴포넌트가 함께 읽는다.
 */
import { computed } from "vue";
import { useRouter } from "vue-router";
import { buildViewSections } from "@/lib/seoContent";

const props = defineProps<{
  /** 프리렌더 라우트 키 — router base(/ott)를 뺀 경로 */
  route: string;
  /** 뷰가 이미 제목·여백을 갖고 있으면 true (본문만 이어 붙인다) */
  embedded?: boolean;
}>();

const sections = computed(() => buildViewSections(props.route));

const router = useRouter();

/**
 * v-html 안의 내부 링크는 평범한 <a>라 클릭 시 전체 새로고침이 된다.
 * 같은 앱(/ott) 링크만 가로채 라우터로 넘겨 SPA 이동을 유지한다.
 * (정적 HTML에서는 이 핸들러가 없으므로 일반 링크로 정상 동작한다.)
 */
function onClick(event: MouseEvent): void {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  const anchor = (event.target as HTMLElement | null)?.closest("a");
  if (!anchor) return;
  if (anchor.target && anchor.target !== "_self") return;

  const href = anchor.getAttribute("href") || "";
  if (!href.startsWith("/ott/") && href !== "/ott") return;

  event.preventDefault();
  void router.push(href.replace(/^\/ott/, "") || "/");
}
</script>

<template>
  <!--
    v-html 사용 근거: 여기 들어오는 HTML은 전부 저장소에 커밋된 저작 문구와
    커밋된 시드 JSON에서 계산한 숫자다. 사용자 입력·외부 API 응답은 한 글자도
    섞이지 않으므로 XSS 경로가 없다. 사용자 생성 콘텐츠는 절대 이 경로로 보내지 말 것.
  -->
  <div
    class="sp-article"
    :class="{ 'sp-article--embedded': embedded }"
    @click="onClick"
  >
    <div v-for="section in sections" :key="section.id" v-html="section.html"></div>
  </div>
</template>

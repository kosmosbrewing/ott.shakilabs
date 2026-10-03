<script setup lang="ts">
/**
 * 루트 허브 — "무엇을 비교하는지·어떤 기준으로 환산하는지·어디부터 보면 되는지".
 *
 * 이전에는 서비스 카드 1장(=활성 서비스 1개)만 렌더해 1440×900에서 스크롤조차
 * 생기지 않는 한 화면짜리 페이지였고, 프리렌더에만 있던 본문은 하이드레이션 때
 * 통째로 사라졌다. 지금은 프리렌더와 같은 본문을 뷰가 직접 렌더한다
 * (서비스 목록은 본문의 "비교할 수 있는 서비스" 표가 대신하므로 카드 그리드는 제거).
 */
import { useSEO } from "@/composables/useSEO";
import { getSiteUrl } from "@/lib/site";
import { getFaqItems } from "@/lib/seoContent";
import SeoRichContent from "@/components/seo/SeoRichContent.vue";
import { HOME_META } from "@/lib/pageMeta";

const siteUrl = getSiteUrl();

// 화면 FAQ와 같은 소스에서 뽑는다 — 스키마 문구가 화면 문구와 어긋날 수 없다.
// (프리렌더가 넣는 FAQPage는 하이드레이션 때 제거되므로 런타임 몫은 여기.)
const faqItems = getFaqItems("/");

// FAQ 답변에는 <strong> 같은 인라인 태그가 있다. 스키마에는 보이는 텍스트만 넣는다.
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

// 옛 제목은 수록하지 않는 넷플릭스와 "최저가"를 약속했다. 제목·설명은 프리렌더와 같은 모듈에서 나온다.
useSEO({
  title: HOME_META.title,
  description: HOME_META.description,
  ogImage: `${siteUrl}/og-image.png`,
  jsonLd: {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: "OTT 구독료 비교",
        url: siteUrl,
        description: "유튜브 프리미엄 국가별 구독료를 원화로 환산해 비교",
        potentialAction: {
          "@type": "SearchAction",
          target: `${siteUrl}/?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: faqItems.map((item) => ({
          "@type": "Question",
          name: stripTags(item.q),
          acceptedAnswer: { "@type": "Answer", text: stripTags(item.a) },
        })),
      },
    ],
  },
});
</script>

<template>
  <!-- 문서형 화면도 도구 화면과 같은 프레임(패키지 sh-container, 72rem)에서 시작한다.
       --prose는 글줄만 42rem으로 묶어 읽는 폭을 지키고, 제목·본문의 시작 x는 헤더와 같다. -->
  <div class="sh-container sh-container--prose py-6">
    <SeoRichContent route="/" />
  </div>
</template>

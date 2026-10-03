import type { SiteFooterSection } from "@shakilabs/ui";

/**
 * 푸터 링크 — 활성 서비스 페이지만 (리다이렉트 별칭 제외).
 * 커뮤니티는 백엔드가 없어 운영하지 않으므로 링크하지 않는다(lib/features.ts).
 */
export const FOOTER_SECTIONS: readonly SiteFooterSection[] = [
  {
    title: "가격 비교",
    links: [
      { to: "/youtube-premium", label: "유튜브 프리미엄 국가별 요금" },
      { to: "/youtube-premium/trends", label: "국가별 가격 격차" },
    ],
  },
];

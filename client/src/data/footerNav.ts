import type { SiteFooterSection } from "@shakilabs/ui";

/** 푸터 링크 — 활성 서비스 페이지와 커뮤니티만 (리다이렉트 별칭 제외) */
export const FOOTER_SECTIONS: readonly SiteFooterSection[] = [
  {
    title: "가격 비교",
    links: [
      { to: "/youtube-premium", label: "유튜브 프리미엄" },
      { to: "/community", label: "커뮤니티" },
    ],
  },
];

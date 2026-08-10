import { describe, expect, it } from "vitest";
import { buildSections, buildViewSections, getFaqItems } from "./seoContent";

const SITEMAP_ROUTES = [
  "/",
  "/about",
  "/privacy",
  "/terms",
  "/youtube-premium",
  "/youtube-premium/trends",
];

const stripTags = (html: string) =>
  html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

describe("seo content sections", () => {
  it.each([...SITEMAP_ROUTES, "/youtube-premium/kr"])(
    "%s 는 뷰가 렌더할 섹션을 최소 1개 갖는다",
    (route) => {
      // 전부 live면 화면에 아무것도 안 남고 프리렌더 본문만 정적 HTML에 갇힌다 —
      // 이 앱이 실제로 겪었던 상태다(크롤러에게만 보이는 텍스트).
      expect(buildViewSections(route).length).toBeGreaterThan(0);
    }
  );

  it.each(SITEMAP_ROUTES)("%s 섹션은 id가 고유하다", (route) => {
    const ids = buildSections(route).map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("FAQ 스키마 문구는 화면에 렌더되는 문구와 같은 소스에서 나온다", () => {
    for (const route of ["/", "/youtube-premium", "/youtube-premium/trends"]) {
      const faqItems = getFaqItems(route);
      expect(faqItems.length).toBeGreaterThan(0);

      const allHtml = buildSections(route)
        .map((section) => stripTags(section.html))
        .join(" ");
      for (const item of faqItems) {
        expect(allHtml).toContain(stripTags(item.q));
      }
    }
  });

  it("국가 라우트는 각자의 국가명이 들어간 고유 문구를 갖는다", () => {
    const textFor = (route: string) =>
      buildViewSections(route)
        .map((section) => stripTags(section.html))
        .join(" ");

    const india = textFor("/youtube-premium/in");
    const turkey = textFor("/youtube-premium/tr");

    expect(india).toContain("인도");
    expect(turkey).toContain("튀르키예");
    // 국가별로 실제 다른 문구가 나와야 한다(템플릿만 돌려 쓰면 같아진다)
    expect(india).not.toEqual(turkey);
  });

  it("알 수 없는 라우트는 빈 배열을 준다", () => {
    expect(buildSections("/nope")).toEqual([]);
    expect(buildViewSections("/nope")).toEqual([]);
  });
});

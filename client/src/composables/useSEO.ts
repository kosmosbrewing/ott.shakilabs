import { useHead } from "@unhead/vue";
import { toValue, type MaybeRefOrGetter } from "vue";
import { getCanonicalSiteUrl } from "@/lib/site";

type SEOOptions = {
  title: MaybeRefOrGetter<string>;
  description: MaybeRefOrGetter<string>;
  ogImage?: MaybeRefOrGetter<string | undefined>;
  noindex?: MaybeRefOrGetter<boolean | undefined>;
  jsonLd?: MaybeRefOrGetter<Record<string, unknown> | undefined>;
  /**
   * Overrides the app-relative path used for canonical / hreflang / og:url.
   * Country variant routes (/youtube-premium/:code) pass the service page
   * because their body is one template with only the numbers swapped —
   * canonical consolidation instead of noindex, so the ranking signals merge
   * into the service page rather than being thrown away. Must stay in sync
   * with canonicalPathFor() in scripts/seo-routes.mjs, which stamps the same
   * value into the prerendered HTML.
   */
  canonicalPath?: MaybeRefOrGetter<string | undefined>;
};

// 페이지별 메타태그 동적 설정
export function useSEO({
  title,
  description,
  ogImage,
  noindex = false,
  jsonLd,
  canonicalPath,
}: SEOOptions): void {
  useHead(() => {
    const resolvedTitle = toValue(title);
    const resolvedDescription = toValue(description);
    const resolvedNoindex = Boolean(toValue(noindex));
    const resolvedOgImage = toValue(ogImage);
    const resolvedJsonLd = toValue(jsonLd);
    const resolvedCanonicalPath = toValue(canonicalPath);
    const currentUrl =
      typeof window !== "undefined"
        ? (() => {
            try {
              const browserUrl = new URL(window.location.href);
              const canonicalUrl = new URL(getCanonicalSiteUrl());
              const basePath = canonicalUrl.pathname.replace(/\/+$/, "");
              const browserPath = browserUrl.pathname.replace(/\/+$/, "") || "/";
              // 오버라이드가 있으면 주소창 경로 대신 그 값을 쓴다 —
              // canonical·hreflang·og:url이 항상 같은 경로에서 나오게 하기 위함
              const routePath = resolvedCanonicalPath
                ? resolvedCanonicalPath.replace(/\/+$/, "")
                : browserPath.startsWith(`${basePath}/`)
                  ? browserPath.slice(basePath.length)
                  : browserPath === basePath || browserPath === "/"
                    ? ""
                    : browserPath;
              canonicalUrl.pathname = `${basePath}${routePath}`;
              return canonicalUrl.toString();
            } catch {
              return getCanonicalSiteUrl();
            }
          })()
        : undefined;

    return {
      title: resolvedTitle,
      link: currentUrl
        ? [
            { rel: "canonical", href: currentUrl },
            { rel: "alternate", hreflang: "ko", href: currentUrl },
            { rel: "alternate", hreflang: "x-default", href: currentUrl },
          ]
        : [],
      meta: [
        { name: "description", content: resolvedDescription },
        { property: "og:title", content: resolvedTitle },
        { property: "og:description", content: resolvedDescription },
        { name: "twitter:title", content: resolvedTitle },
        { name: "twitter:description", content: resolvedDescription },
        ...(currentUrl ? [{ property: "og:url", content: currentUrl }] : []),
        ...(resolvedNoindex ? [{ name: "robots", content: "noindex,nofollow" }] : []),
        ...(resolvedOgImage
          ? [
              { property: "og:image", content: resolvedOgImage },
              { name: "twitter:image", content: resolvedOgImage },
            ]
          : []),
      ],
      // @unhead/vue v2는 스크립트 본문을 innerHTML/textContent로만 렌더한다.
      // v1의 children은 v2에서 스키마 키가 아니라 일반 prop이라, 기본 플러그인 구성
      // (DeprecationsPlugin 미등록)에서는 본문 대신 children="..." HTML 속성으로 새어나가
      // 본문이 빈 ld+json 블록이 만들어진다.
      script: resolvedJsonLd
        ? [
            {
              key: "json-ld",
              type: "application/ld+json",
              innerHTML: JSON.stringify(resolvedJsonLd),
            },
          ]
        : [],
    };
  });
}

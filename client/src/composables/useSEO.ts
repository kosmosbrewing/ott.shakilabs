import { useHead } from "@unhead/vue";
import { toValue, type MaybeRefOrGetter } from "vue";
import { getCanonicalSiteUrl } from "@/lib/site";

type SEOOptions = {
  title: MaybeRefOrGetter<string>;
  description: MaybeRefOrGetter<string>;
  ogImage?: MaybeRefOrGetter<string | undefined>;
  noindex?: MaybeRefOrGetter<boolean | undefined>;
  jsonLd?: MaybeRefOrGetter<Record<string, unknown> | undefined>;
};

// 페이지별 메타태그 동적 설정
export function useSEO({
  title,
  description,
  ogImage,
  noindex = false,
  jsonLd,
}: SEOOptions): void {
  useHead(() => {
    const resolvedTitle = toValue(title);
    const resolvedDescription = toValue(description);
    const resolvedNoindex = Boolean(toValue(noindex));
    const resolvedOgImage = toValue(ogImage);
    const resolvedJsonLd = toValue(jsonLd);
    const currentUrl =
      typeof window !== "undefined"
        ? (() => {
            try {
              const browserUrl = new URL(window.location.href);
              const canonicalUrl = new URL(getCanonicalSiteUrl());
              const basePath = canonicalUrl.pathname.replace(/\/+$/, "");
              const browserPath = browserUrl.pathname.replace(/\/+$/, "") || "/";
              const routePath = browserPath.startsWith(`${basePath}/`)
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
      script: resolvedJsonLd
        ? [
            {
              key: "json-ld",
              type: "application/ld+json",
              children: JSON.stringify(resolvedJsonLd),
            },
          ]
        : [],
    };
  });
}

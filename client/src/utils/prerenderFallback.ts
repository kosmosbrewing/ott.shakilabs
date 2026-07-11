export function removePrerenderFallback(root: ParentNode = document): number {
  const fallbacks = root.querySelectorAll("body > [data-seo-prerender]");
  fallbacks.forEach((fallback) => fallback.remove());
  return fallbacks.length;
}

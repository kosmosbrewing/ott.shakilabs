import { describe, expect, it, vi } from "vitest";
import { removePrerenderFallback } from "./prerenderFallback";

describe("removePrerenderFallback", () => {
  it("removes every prerender sibling after the app mounts", () => {
    const fallbacks = [{ remove: vi.fn() }, { remove: vi.fn() }];
    const root = {
      querySelectorAll: vi.fn(() => fallbacks),
    } as unknown as ParentNode;

    expect(removePrerenderFallback(root)).toBe(2);
    expect(root.querySelectorAll).toHaveBeenCalledWith("body > [data-seo-prerender]");
    expect(fallbacks.every((fallback) => fallback.remove.mock.calls.length === 1)).toBe(true);
  });
});

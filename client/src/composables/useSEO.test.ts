import { describe, expect, it, vi } from "vitest";

// useHead를 가로채 useSEO가 만든 head 객체를 그대로 꺼내 본다.
const captured: Array<Record<string, unknown>> = [];
vi.mock("@unhead/vue", () => ({
  useHead: (input: () => Record<string, unknown>) => {
    captured.push(input());
  },
}));

const { useSEO } = await import("./useSEO");

type ScriptEntry = {
  key?: string;
  type?: string;
  innerHTML?: string;
  children?: string;
};

function headFor(jsonLd?: Record<string, unknown>): Record<string, unknown> {
  captured.length = 0;
  useSEO({ title: "t", description: "d", jsonLd });
  return captured[0];
}

describe("useSEO", () => {
  it("renders JSON-LD through innerHTML — @unhead/vue v2 ignores the v1 `children` field", () => {
    const jsonLd = { "@context": "https://schema.org", "@type": "WebPage", name: "p" };
    const scripts = headFor(jsonLd) as { script: ScriptEntry[] };

    expect(scripts.script).toHaveLength(1);
    const [entry] = scripts.script;
    expect(entry.type).toBe("application/ld+json");
    // v2에서 children은 스키마 키가 아니라 일반 prop이라 children="..." 속성으로 새어나간다.
    expect(entry.children).toBeUndefined();
    expect(typeof entry.innerHTML).toBe("string");
    expect(entry.innerHTML?.length).toBeGreaterThan(0);
    expect(JSON.parse(entry.innerHTML as string)).toEqual(jsonLd);
  });

  it("emits no script tag when there is no JSON-LD", () => {
    const head = headFor(undefined) as { script: ScriptEntry[] };
    expect(head.script).toEqual([]);
  });
});

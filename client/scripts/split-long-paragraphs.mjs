// v8b(2026-10-03): 프리렌더 HTML 문자열의 <p>가 250자를 넘으면 문장 경계에서 ≤200자 <p> 여러 개로 나눈다.
// 콘텐츠 빌더(buildRichContent 등)의 반환값에 한 번 적용하므로 정적 HTML과 Vue 런타임(같은 함수를 import)이
// 같은 결과를 낸다. 글자는 손대지 않는다 — 인라인 태그가 걸친 경계는 건너뛰어 태그 균형을 지킨다.
const LIMIT = 250;
const MAX = 200;

function textLength(inner) {
  return inner.replace(/<[^>]+>/g, "").replace(/&[a-z#0-9]+;/g, "x").replace(/\s+/g, " ").trim().length;
}

function balanced(fragment) {
  const open = [...fragment.matchAll(/<([a-z][a-z0-9]*)\b[^>]*?(?<!\/)>/gi)].map((m) => m[1].toLowerCase());
  const close = [...fragment.matchAll(/<\/([a-z][a-z0-9]*)>/gi)].map((m) => m[1].toLowerCase());
  if (open.length !== close.length) return false;
  const count = {};
  for (const t of open) count[t] = (count[t] || 0) + 1;
  for (const t of close) count[t] = (count[t] || 0) - 1;
  return Object.values(count).every((n) => n === 0);
}

function splitInner(inner) {
  // 문장 경계: 마침표·물음표·느낌표(닫는 인라인 태그가 바로 뒤따라도) 뒤 공백 — 숫자 안의 점은 공백이 없다
  const sentences = inner.split(/(?<=[.!?](?:<\/[a-z]+>)?)\s+(?=\S)/).filter(Boolean);
  if (sentences.length < 2) return null;
  const out = [];
  let cur = "";
  for (const s of sentences) {
    const cand = cur ? `${cur} ${s}` : s;
    if (textLength(cand) > MAX && cur) {
      out.push(cur);
      cur = s;
    } else cur = cand;
  }
  if (cur) out.push(cur);
  if (out.length < 2 || !out.every(balanced)) return null;
  return out;
}

export function splitLongParagraphs(html) {
  if (typeof html !== "string") return html;
  return html.replace(/<p\b([^>]*)>([\s\S]*?)<\/p>/g, (whole, attrs, inner) => {
    if (textLength(inner) <= LIMIT) return whole;
    const parts = splitInner(inner);
    if (!parts) return whole;
    return parts.map((p) => `<p${attrs}>${p}</p>`).join("");
  });
}

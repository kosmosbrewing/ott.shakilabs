// BRIEF-V8B 문단 게이트: 빌드 산출물(dist)의 모든 <p>가 250자 이하여야 한다(약관·방침 제외).
// 소스가 아니라 렌더 결과를 보므로 데이터 쪽 chunkParagraph를 놓친 경로(다이제스트·뷰 직접 렌더)까지 잡는다.
// 엔티티(&lt; 등)는 디코드해 센다 — 실제 글자 수 기준. 역방향: 분할을 끄면 즉시 실패한다.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const LIMIT = 250;
const SKIP = /(^|\/)(terms|privacy)(\.html|\/index\.html)$/;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function htmlFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) htmlFiles(full, out);
    else if (name.endsWith(".html")) out.push(full);
  }
  return out;
}

function decode(text) {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// known: { "shipping-compare.html": 276 } — 문장 경계가 없는 단일 문장(나열 한 문장)만 등록, 더 길어지면 실패
export function validateParagraphLength({ distRoot, limit = LIMIT, known = {} }) {
  const files = htmlFiles(distRoot).filter((f) => !SKIP.test(relative(distRoot, f)));
  assert(files.length > 0, "No HTML files found for the paragraph-length gate");
  const violations = [];
  let checked = 0;
  for (const file of files) {
    const html = readFileSync(file, "utf8");
    for (const m of html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
      const text = decode(m[1]);
      checked += 1;
      const rel = relative(distRoot, file);
      const cap = known[rel] ?? limit;
      if (text.length > cap) violations.push(`${rel}: ${text.length}자 (허용 ${cap}) "${text.slice(0, 40)}…"`);
    }
  }
  assert(
    violations.length === 0,
    `Paragraphs over ${limit} chars in built HTML (split at sentence boundaries — never delete sentences):\n  ` +
      violations.slice(0, 20).join("\n  ") + (violations.length > 20 ? `\n  … +${violations.length - 20}` : "")
  );
  return checked;
}

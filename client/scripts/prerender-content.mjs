// 프리렌더(Node) 어댑터 — 문구는 전부 seo-content.mjs에 있고 여기서는 데이터만 붙인다.
//
// seo-content.mjs는 브라우저 번들에도 들어가므로 node:fs를 쓸 수 없다.
// 그래서 디스크 읽기는 이 파일이 담당하고, 뷰 쪽은 Vite가 번들한 JSON을 주입한다.
// 두 소비자가 같은 시드 JSON을 보므로 정적 HTML과 화면의 수치가 어긋나지 않는다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { configureSeoContent, buildRichContent, getFaqItems } from "./seo-content.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, relativePath), "utf-8"));
}

configureSeoContent({
  priceSeed: readJson("../../data/prices/youtube-premium.json"),
  history: readJson("../../data/history/youtube-premium.json"),
  changelog: readJson("../../data/reports/changelog.json"),
  services: readJson("../../data/services.json"),
});

export { buildRichContent, getFaqItems };

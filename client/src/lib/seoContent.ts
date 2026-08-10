/**
 * 브라우저 쪽 seo-content 바인딩 — 시드 JSON 주입을 여기 한 곳에서만 한다.
 *
 * 프리렌더(Node)는 scripts/prerender-content.mjs가 fs로 같은 JSON을 주입한다.
 * 두 소비자가 같은 데이터를 보므로 정적 HTML과 화면의 수치가 어긋나지 않는다.
 *
 * 이 모듈을 거치지 않고 seo-content.mjs를 직접 import하면 주입 순서에 따라
 * "not configured" 에러가 날 수 있으니, src 안에서는 항상 여기서 가져다 쓴다.
 */
import {
  configureSeoContent,
  buildSections,
  buildViewSections,
  getFaqItems,
  type SeoContentSection,
} from "../../scripts/seo-content.mjs";
import priceSeed from "../../../data/prices/youtube-premium.json";
import history from "../../../data/history/youtube-premium.json";
import changelog from "../../../data/reports/changelog.json";
import services from "../../../data/services.json";

configureSeoContent({ priceSeed, history, changelog, services });

export { buildSections, buildViewSections, getFaqItems };
export type { SeoContentSection };

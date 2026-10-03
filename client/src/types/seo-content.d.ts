// scripts/seo-content.mjs(프리렌더·뷰 공용 단일 소스)를 src에서 타입과 함께 쓰기 위한 선언.
// tsconfig의 include가 src/**만 잡으므로 scripts/*.mjs는 TS 프로그램 밖이고,
// 앞의 와일드카드(*)가 있어야 상대 경로 import가 이 선언으로 해석된다.
declare module "*seo-content.mjs" {
  /**
   * 한 라우트의 콘텐츠 조각.
   * live=true면 뷰가 같은 내용을 API 데이터로 라이브 렌더하므로 뷰에서는 건너뛴다.
   */
  export interface SeoContentSection {
    id: string;
    live: boolean;
    html: string;
  }

  export interface SeoContentData {
    priceSeed: unknown;
    history: unknown;
    changelog: unknown;
    services: unknown;
  }

  export const ARTICLE: string;
  export function configureSeoContent(data: SeoContentData): void;
  export function buildSections(route: string): SeoContentSection[];
  export function buildViewSections(route: string): SeoContentSection[];
  export function buildRichContent(route: string): string | null;
  export function getFaqItems(route: string): { q: string; a: string }[];

  /** 가격표 페이지의 요금 조사 문장 — 숫자·날짜는 국가 행의 survey 블록에서 계산한다. */
  export function getSurveyProvenance(): string;
  /** 표 한 칸의 조사 상태. 재확인한 칸만 재확인 날짜를 단다. */
  export function surveyCellMark(
    row: unknown,
    planId: string
  ): { status: "rechecked" | "retained"; text: string } | null;
  /** 국가 상세의 조사 표기 — 재확인 날짜는 재확인한 요금제에만 붙는다. */
  export function surveyCountryLabel(row: unknown): string | null;
}

// scripts/page-meta.mjs(프리렌더·뷰 공용 단일 소스)를 src에서 타입과 함께 쓰기 위한 선언
export interface PageMeta {
  title: string;
  description: string;
}

export const SITE_BRAND: string;
export const APP_NAME: string;
export const BRAND_SUFFIX: string;
export const MAX_PAGE_TITLE_CHARS: number;
export const HOME_TITLE: string;

export function toolTitle(pageTitle: string): string;
export function appPageTitle(pageTitle: string): string;
export function homeMeta(stats: { countryCount: number }): PageMeta;
export function serviceMeta(stats: { countryCount: number; surveyDate: string }): PageMeta;
export function trendsMeta(): PageMeta;
export function countryMeta(input: {
  country: string;
  krw: number | null | undefined;
  isBaseCountry: boolean;
}): PageMeta;

export const ABOUT_META: PageMeta;
export const PRIVACY_META: PageMeta;
export const TERMS_META: PageMeta;
export const COMMUNITY_META: PageMeta;
export const COMMUNITY_POST_META: PageMeta;
export const NOT_FOUND_META: PageMeta;

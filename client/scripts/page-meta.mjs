// 페이지 제목·설명(<title>·description·og·twitter)의 단일 출처.
//
// 왜 한 파일인가: 이 앱은 프리렌더(scripts/prerender.mjs)가 원시 HTML의 제목을 박고,
// 하이드레이션 뒤에는 뷰의 useSEO(useHead)가 다시 쓴다. 두 쪽이 문자열을 따로 들고 있어
// 국가 페이지는 크롤러에겐 "유튜브 프리미엄 말레이시아 가격", 화면에선 "YouTube Premium 말레이시아 가격"으로
// 갈렸고, 개인정보처리방침은 설명이 아예 달랐다. 양쪽이 이 모듈을 import하면 어긋날 수 없다.
//
// 레시피(2026-10-02 네이버 CTR 작업, 10-03 수정 — 함대 공통):
//   도구 페이지(가격표·격차·국가)   `<페이지 제목> | ShakiLabs`
//   홈                           `<앱 이름> | ShakiLabs`
//   소개·약관·방침·커뮤니티·404     `<페이지 제목> · <앱 이름> | ShakiLabs`
// 가운데 앱 이름 접미사(" | OTT 가격 비교")를 뺀 이유: 네이버는 제목을 약 35자에서 자르는데
// 접미사가 핵심 구절을 먹었다. 사이트 공통 페이지만 앱 이름을 남기는 이유는, 빼면
// "이용약관 | ShakiLabs"가 12개 앱에서 똑같아져 도메인 안 중복 제목이 되기 때문이다.
// 페이지 제목은 40자 이하, 검색 구절은 앞 28자 안 — validate-static-output.mjs가 산출물로 지킨다.
//
// 숫자(국가 수·조사일)는 호출부가 가격 시드에서 계산해 넘긴다. 문자열에 박아 두면
// 재조사로 국가 수가 바뀌어도 제목만 옛 숫자를 말한다.

export const SITE_BRAND = "ShakiLabs";
export const APP_NAME = "OTT 구독료 비교";
export const BRAND_SUFFIX = ` | ${SITE_BRAND}`;
export const MAX_PAGE_TITLE_CHARS = 40;

/** 도구 페이지 — `<페이지 제목> | ShakiLabs` */
export function toolTitle(pageTitle) {
  return `${pageTitle}${BRAND_SUFFIX}`;
}

/** 홈 외 사이트 공통 페이지 — `<페이지 제목> · <앱 이름> | ShakiLabs` */
export function appPageTitle(pageTitle) {
  return `${pageTitle} · ${APP_NAME}${BRAND_SUFFIX}`;
}

export const HOME_TITLE = `${APP_NAME}${BRAND_SUFFIX}`;

const formatKrw = (krw) => `₩${Math.round(krw).toLocaleString("ko-KR")}`;

/** 루트 허브(/) — 비교 기준·데이터 출처 안내. /youtube-premium과 검색 의도가 겹치지 않게 방법론을 앞세운다. */
export function homeMeta({ countryCount }) {
  return {
    title: HOME_TITLE,
    description:
      `유튜브 프리미엄 ${countryCount}개국 요금을 어떤 기준으로 비교하는지 안내합니다. ` +
      "원화 환산 방식, 요금 조사일·환율 기준일, 요금제 용어를 확인하고 국가별 요금표로 이동하세요.",
  };
}

/**
 * 메인 문서(/youtube-premium) — 네이버 클릭 1위(30일 247클릭).
 * 검색 구절 "유튜브 프리미엄 국가별 요금 비교"(노출 226)를 맨 앞에 둔다.
 * 조사일을 설명에 그대로 싣는 이유: 요금이 언제 기준인지는 숨길 정보가 아니다(재조사는 별도 작업).
 */
export function serviceMeta({ countryCount, surveyDate }) {
  return {
    title: toolTitle(`유튜브 프리미엄 국가별 요금 비교 · ${countryCount}개국 원화 환산 순위`),
    description:
      `유튜브 프리미엄 ${countryCount}개국 요금을 원화로 환산해 비교합니다. ` +
      "프리미엄·패밀리·라이트·듀오 요금제별 국가 순위와 한국 대비 차이, " +
      `요금 조사일(${surveyDate})과 환율 기준일을 함께 표시합니다.`,
  };
}

export function trendsMeta() {
  return {
    title: toolTitle("유튜브 프리미엄 국가별 가격 격차 · 대륙별 평균·환율 영향"),
    description:
      "유튜브 프리미엄 국가별 구독료를 같은 시점 기준으로 비교합니다. 요금 낮은 순·한국 대비 차이 순위, " +
      "대륙별 평균, 환율이 순위를 바꾸는 지점. 실시간 시세·가격 변동 시계열은 제공하지 않습니다.",
  };
}

/**
 * 국가 변형(/youtube-premium/:code) — 서비스 페이지로 canonical 통합된 44개 페이지.
 * 검색어가 "<국가> 유튜브 프리미엄" 순서라(말레이시아 CTR 36.8%) 국가명을 앞에 둔다.
 * krw는 개인 요금제 원화 — 기준국(KRW)은 환산 왕복 오차를 피해 현지 정가를 넘긴다.
 */
export function countryMeta({ country, krw, isBaseCountry }) {
  const title = isBaseCountry
    ? toolTitle(`${country} 유튜브 프리미엄 요금 · 요금제별 정가와 해외 비교`)
    : toolTitle(`${country} 유튜브 프리미엄 요금 · 원화 환산 한국 대비`);
  if (isBaseCountry) {
    // 기준국에 "한국 대비 차이"는 0이라 뜻이 없다 — 해외 순위 속 위치를 말한다.
    const priceText = krw != null ? `개인 요금제는 월 ${formatKrw(krw)}입니다. ` : "";
    return {
      title,
      description:
        `${country} 유튜브 프리미엄 ${priceText}` +
        "요금제별 정가와 해외 요금 순위 속 위치, 같은 대륙 국가와의 비교, 요금 조사일을 함께 보여 줍니다.",
    };
  }
  const priceText = krw != null ? `개인 요금제는 월 ${formatKrw(krw)}(원화 환산)입니다. ` : "";
  return {
    title,
    description:
      `${country} 유튜브 프리미엄 ${priceText}` +
      "요금제별 현지 정가와 한국 대비 차이, 같은 대륙 국가와의 비교, 요금 조사일을 함께 보여 줍니다.",
  };
}

export const ABOUT_META = {
  title: appPageTitle("서비스 소개와 데이터 출처"),
  // "갱신 주기를 안내합니다"는 존재하지 않는 주기를 예고했다 — 쓰지 않는다.
  description:
    "유튜브 프리미엄 가격 비교 서비스의 데이터 출처와 요금 조사일·환율 기준일 표기 방식을 안내합니다.",
};

export const PRIVACY_META = {
  title: appPageTitle("개인정보처리방침"),
  description:
    "OTT 구독료 비교 서비스의 개인정보처리방침입니다. 수집 항목, Google Analytics·AdSense 등 제3자 서비스, " +
    "쿠키와 맞춤 광고 거부 방법을 안내합니다.",
};

export const TERMS_META = {
  title: appPageTitle("이용약관"),
  description:
    "OTT 구독료 비교 서비스 이용약관입니다. 서비스 이용 조건, 데이터 정확성, 광고 안내 등을 확인하세요.",
};

// 커뮤니티는 백엔드 라우트가 없어 운영하지 않는다 — noindex·사이트맵 제외·링크 0으로 둔다.
export const COMMUNITY_META = {
  title: appPageTitle("커뮤니티"),
  description: "OTT 구독료 비교 커뮤니티 게시판 안내입니다. 게시판은 현재 운영하지 않습니다.",
};

export const COMMUNITY_POST_META = {
  title: appPageTitle("커뮤니티 글"),
  description: "OTT 구독료 비교 커뮤니티 게시판은 현재 운영하지 않습니다.",
};

export const NOT_FOUND_META = {
  title: appPageTitle("페이지를 찾을 수 없습니다"),
  description: "요청하신 페이지가 존재하지 않거나 이동되었습니다. 유튜브 프리미엄 국가별 요금표로 이동하세요.",
};

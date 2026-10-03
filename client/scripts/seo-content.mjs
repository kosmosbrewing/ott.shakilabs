// OttWatcher SEO 리치 콘텐츠 — 프리렌더(scripts)와 뷰(src)가 공유하는 단일 소스.
//
// 왜 공유하나: 프리렌더 블록은 하이드레이션 때 removePrerenderFallback()이 제거한다.
// 제거가 안전하려면 "프리렌더 = 뷰가 렌더하는 것의 사본"이어야 하는데, 콘텐츠를
// 프리렌더에만 넣으면 그 전제가 깨져 JS 켠 사용자와 렌더링 크롤러에게서 본문이
// 사라진다(= 크롤러에게만 보이는 은닉 텍스트). 그래서 문구는 이 파일 한 곳에만 둔다.
//
// 이 파일은 Node(프리렌더)와 Vite(브라우저 번들) 양쪽에서 import되므로
// node:fs 같은 런타임 전용 API를 쓰면 안 된다. 데이터는 configureSeoContent()로 주입한다.
// 스타일도 인라인 색상 대신 .sp-* 클래스만 쓴다 — 뷰에 그대로 심으면 다크 모드에서
// 하드코딩 색상이 깨지기 때문이다(스타일은 assets/css/seo-content.css).

import * as D from "./seo-discoveries.mjs";

let _data = null;
// conversionAudit는 KRW 보정 "전"의 원본을 봐야 한다. 보정본을 넘기면
// 왕복 오차가 이미 지워진 상태라 "원화값은 파생값"이라는 검증이 통과해 버린다.
let _rawPriceSeed = null;
let _history = null;
let _changelog = null;
let _services = null;

/**
 * 데이터 주입 — Node는 fs로 읽은 JSON을, 브라우저는 Vite가 번들한 JSON을 넘긴다.
 * 두 소비자 모두 모듈 로드 직후 1회만 호출한다.
 */
// 런타임 priceTransforms.normalizePricesResponse와 같은 보정: 원화 표시 국가의
// converted.krw를 현지 정가로 덮는다. 시드의 converted.krw는 KRW→USD→KRW 왕복이라
// 14,900이 14,897로 어긋난 채 정적 콘텐츠(절약률·비교표)에 새어 나가고 있었다.
export function normalizeKrwSeed(priceSeed) {
  if (!priceSeed || !Array.isArray(priceSeed.prices)) return priceSeed;
  return {
    ...priceSeed,
    prices: priceSeed.prices.map((country) => {
      if (String(country?.currency || "").toUpperCase() !== "KRW" || !country.plans) return country;
      const converted = { ...(country.converted || {}) };
      for (const [planId, plan] of Object.entries(country.plans)) {
        const monthly = Number(plan?.monthly);
        if (!Number.isFinite(monthly)) continue;
        converted[planId] = { ...(converted[planId] || {}), krw: monthly };
      }
      return { ...country, converted };
    }),
  };
}

export function configureSeoContent({ priceSeed, history, changelog, services }) {
  _rawPriceSeed = priceSeed;
  _data = normalizeKrwSeed(priceSeed);
  _history = history;
  _changelog = changelog;
  _services = services;
}

function assertConfigured(value, name) {
  if (!value) {
    throw new Error(
      `[seo-content] ${name} not configured — call configureSeoContent() before building content`
    );
  }
  return value;
}

function loadData() {
  return assertConfigured(_data, "priceSeed");
}

function loadHistory() {
  return assertConfigured(_history, "history");
}

function loadChangelog() {
  return assertConfigured(_changelog, "changelog");
}

function loadServices() {
  return assertConfigured(_services, "services");
}

// 루트 허브에 쓰는 집계값 — 전부 가격 시드에서 도출한다(추정치 금지).
function computeCatalogStats() {
  const data = loadData();
  const priced = data.prices
    .filter((p) => p.converted?.individual?.krw)
    .map((p) => ({ ...p, krw: p.converted.individual.krw }))
    .sort((a, b) => a.krw - b.krw);
  const kr = data.prices.find((p) => p.countryCode === "KR");
  // 기준국(KRW)은 환산 왕복(14,900→14,897) 오차를 피해 현지 정가를 그대로 쓴다
  const krKrw = kr?.plans?.individual?.monthly ?? kr?.converted?.individual?.krw ?? null;
  const cheapest = priced[0] || null;
  const priciest = priced[priced.length - 1] || null;
  const continents = new Set(data.prices.map((p) => p.continent).filter(Boolean));
  const spread =
    cheapest && priciest && cheapest.krw > 0 ? priciest.krw / cheapest.krw : null;

  return {
    data,
    countryCount: data.prices.length,
    pricedCount: priced.length,
    continentCount: continents.size,
    krKrw,
    cheapest,
    priciest,
    spread,
  };
}

// 트렌드 페이지 공용 통계 — 스냅샷·현재가에서 도출 가능한 사실만 계산한다.
// 런타임 buildTimelineRows(trendCalculations.ts)와 같은 선정 규칙(기준국 + 하락/상승 각 5).
function computeTrendStats() {
  const data = loadData();
  const history = loadHistory();
  const snapshots = (history.snapshots || [])
    .filter((s) => s && typeof s.date === "string" && Array.isArray(s.prices))
    .sort((a, b) => a.date.localeCompare(b.date));

  const currentByCode = new Map();
  const nameByCode = new Map();
  for (const p of data.prices) {
    const code = String(p.countryCode || "").toUpperCase();
    if (!code) continue;
    nameByCode.set(code, p.country || code);
    const krw = p.converted?.individual?.krw;
    if (typeof krw === "number") currentByCode.set(code, krw);
  }

  const lastSnapshot = snapshots[snapshots.length - 1] || null;
  const movers = [];
  for (const item of lastSnapshot?.prices || []) {
    const code = String(item.countryCode || "").toUpperCase();
    const prevKrw = item.krw;
    const currentKrw = currentByCode.get(code);
    if (!code || typeof prevKrw !== "number" || prevKrw <= 0 || typeof currentKrw !== "number") continue;
    movers.push({
      code,
      prevKrw,
      currentKrw,
      changePercent: Math.round(((currentKrw - prevKrw) / prevKrw) * 1000) / 10,
    });
  }
  movers.sort((a, b) => a.changePercent - b.changePercent);

  const falls = movers.filter((m) => m.changePercent < 0);
  const rises = movers.filter((m) => m.changePercent > 0);
  const percents = movers.map((m) => m.changePercent);
  const median = percents.length
    ? percents.length % 2
      ? percents[(percents.length - 1) / 2]
      : Math.round(((percents[percents.length / 2 - 1] + percents[percents.length / 2]) / 2) * 10) / 10
    : null;

  const sample = [...falls.slice(0, 5), ...rises.slice(-5)].filter((m) => m.code !== "KR");
  sample.sort((a, b) => a.changePercent - b.changePercent);
  const baseMover = movers.find((m) => m.code === "KR") || null;

  const timelineDates = [...snapshots.map((s) => s.date), data.lastUpdated].filter(Boolean);
  const krwBySnapshotDate = new Map(
    snapshots.map((s) => [
      s.date,
      new Map(s.prices.map((i) => [String(i.countryCode || "").toUpperCase(), i.krw])),
    ])
  );

  return {
    data,
    snapshots,
    currentByCode,
    nameByCode,
    lastSnapshot,
    movers,
    falls,
    rises,
    median,
    sample,
    baseMover,
    timelineDates,
    krwBySnapshotDate,
  };
}

// --- 공통 스타일 (클래스명만; 실제 규칙은 assets/css/seo-content.css) ---
// 인라인 색상을 쓰지 않는 이유: 같은 HTML이 프리렌더(JS 끔)와 Vue 뷰(다크 모드 가능)
// 양쪽에 그대로 들어가므로, 색상은 반드시 테마 변수(hsl(var(--...)))를 타야 한다.
// JS를 꺼도 빌드된 CSS는 <link>로 로드되므로 정적 HTML도 동일하게 스타일된다.
export const ARTICLE = "sp-article";
// 프리렌더 article의 바깥 프레임 — 뷰와 같은 패키지 컨테이너(72rem·여백 clamp)다.
// JS 끔 화면과 수화 직전 첫 페인트도 헤더와 같은 x에서 시작해야 수화 때 본문이 옆으로 뛰지 않는다.
// --prose는 글줄(p·h·ul)만 42rem으로 묶고 표는 프레임 폭을 그대로 쓴다.
export const PRERENDER_FRAME = "sh-container sh-container--prose";
const H1 = "sp-h1";
const H2 = "sp-h2";
const H3 = "sp-h3";
const P = "sp-p";
const TABLE = "sp-table";
const TH = "sp-th";
const TD = "sp-td";
const UL = "sp-ul";
const LI = "sp-li";
const CALLOUT = "sp-callout";
const INFO = "sp-info";

function formatKrw(value) {
  return `₩${Math.round(value).toLocaleString("ko-KR")}`;
}

// --- 요금 조사 표기 — 숫자·날짜는 전부 국가 행의 survey 블록에서 온다(seo-discoveries.mjs) ---
// 전수 조사일과 재확인일을 섞으면 재확인하지 못한 값까지 새 날짜로 읽힌다.

/** 가격표 페이지의 요금 조사 문장(뷰의 표 하단과 같은 문장). */
export function getSurveyProvenance() {
  return D.surveyProvenanceSentence(loadData());
}

/** 표 칸의 조사 상태 표시("재확인 10-03" / "02-20 값 유지"). */
export const surveyCellMark = D.surveyCellMark;

/** 국가 상세의 조사 표기 — 재확인 날짜는 재확인한 요금제에만 붙는다. */
export const surveyCountryLabel = D.surveyCountryLabel;

/** 제목용 짧은 표기 — 재확인 회차가 있으면 "일부 재확인"으로 범위를 한정한다. */
function surveyHeadline(data) {
  const r = D.surveyRounds(data);
  return r.recheckDate
    ? `${r.fullSurveyDate} 전수 조사 · ${r.recheckDate} 일부 재확인`
    : `요금 조사 ${r.fullSurveyDate} 기준`;
}

/** "사람이 확인한 날"이 어느 값까지인지 — 공식 출처로 다시 확인한 칸만 그렇게 부른다. */
function surveyScopeSentence(data) {
  const r = D.surveyRounds(data);
  const head = `${r.fullSurveyDate}은 ${r.countryCount}개국 현지 통화 정가를 전수 조사한 날이고`;
  if (!r.recheckDate) return `${head}, 그 뒤 다시 확인한 값은 없습니다.`;
  return (
    `${head}, 그중 공식 출처와 직접 대조해 사람이 다시 확인한 것은 ` +
    `${r.recheckDate}의 ${r.recheckedCountries}개국 ${r.recheckedCells}개 값뿐입니다` +
    `(나머지 ${r.retainedCells}개 값은 ${r.fullSurveyDate} 값 그대로).`
  );
}

function formatUsd(value) {
  return `$${Number(value).toFixed(2)}`;
}

function computeSavings(countryKrw, krKrw) {
  if (!krKrw || !countryKrw) return null;
  const diff = krKrw - countryKrw;
  const percent = (diff / krKrw) * 100;
  const annual = diff * 12;
  return { diff, percent, annual };
}

function getContinentLabel(c) {
  const map = {
    asia: "아시아",
    "north-america": "북미",
    "south-america": "남미",
    europe: "유럽",
    africa: "아프리카",
    oceania: "오세아니아",
  };
  return map[c] || c;
}

// =========================
// FAQ 데이터 — 화면 HTML과 FAQPage JSON-LD가 같은 소스를 공유해
// "스키마 텍스트 = 화면 텍스트" 불일치를 원천 차단한다
// =========================

// 한국에 없는 요금제를 문장에서 주장하지 않기 위한 근거 상수.
// YouTube 고객센터가 가족 요금제 미제공 국가로 명시한 목록이며(대한민국 포함),
// 학생 할인도 한국은 제공 국가 목록에 없다. 이 FAQ가 한때 "한국 가족 플랜 월 22,900원"을
// 주장했던 것이 blog(/blog/youtube-premium-prices-2026)와 정면으로 어긋난 원인이었다.
const FAMILY_PLAN_UNAVAILABLE_NOTE =
  "YouTube 고객센터는 가족 요금제 미제공 국가로 대한민국·베네수엘라·벨라루스·슬로베니아·아이슬란드를 명시합니다";

function getHomeFaqItems() {
  const data = loadData();
  // 문구의 숫자는 가격표와 같은 소스에서 뽑는다. 하드코딩하면 표와 본문이 갈라지고,
  // 실제로 그렇게 갈라진 결과가 "표에 없는 가족 플랜"을 본문이 주장하는 상태였다.
  const krRow = (data.prices || []).find(
    (p) => String(p.countryCode || "").toUpperCase() === "KR"
  );
  const krPlans = krRow?.plans || {};
  const fmtWon = (value) => `${Number(value).toLocaleString("ko-KR")}원`;
  const krIndividual = Number(krPlans.individual?.monthly);
  const krLite = Number(krPlans.lite?.monthly);
  const krLiteGap =
    Number.isFinite(krIndividual) && Number.isFinite(krLite)
      ? krIndividual - krLite
      : null;
  // Lite 비율은 "약 50~60%"로 하드코딩돼 있었는데 시드의 실제 범위는 그 밖까지 걸친다.
  // 문장이 표와 어긋나지 않도록 범위 자체를 시드에서 뽑는다.
  const liteRows = D.litePlans(data).members;

  return [
    {
      q: "한국에서 가장 저렴하게 구독하는 방법은 무엇인가요?",
      a: `한국 계정에서 고를 수 있는 요금제는 <strong>개인 플랜(월 ${fmtWon(krIndividual)})</strong>과 <strong>Premium Lite(월 ${fmtWon(krLite)})</strong> 두 가지입니다. 광고 제거·백그라운드 재생만 필요하고 YouTube Music이 필요 없다면 Lite가 월 ${krLiteGap != null ? fmtWon(krLiteGap) : "-"} 저렴합니다. <strong>대한민국은 가족 요금제와 학생 할인 플랜이 모두 제공되지 않는 국가</strong>입니다(${FAMILY_PLAN_UNAVAILABLE_NOTE}). 따라서 여러 명이 나눠 내 1인당 요금을 낮추는 방식은 한국 계정에서는 선택지가 아니며, 이 페이지의 국가별 표에서 한국 행에 가족·학생 요금이 비어 있는 것도 같은 이유입니다.`,
    },
    {
      q: "데이터는 얼마나 자주 업데이트되나요?",
      // 두 날짜는 성격이 다르다. 요금 조사는 자동 수집 수단이 없어 사람이 하고,
      // 환율만 API로 자동 갱신된다. 하나로 뭉뚱그리면 "요금도 매일 갱신된다"로 읽힌다.
      a: `가격 기준일과 환율 기준일은 서로 다르며 따로 표기합니다. <strong>요금 조사: ${getSurveyProvenance()}</strong> — ${surveyScopeSentence(data)} <strong>환율 기준일: ${data.exchangeRateDate}</strong> — 원화 환산에 쓰는 환율은 공개 환율 API에서 자동으로 가져옵니다. 미리 렌더된 페이지의 원화 값은 배포 시점 환율로 계산돼 있어, 지금 보고 계신 시점의 환율과는 차이가 날 수 있습니다.`,
    },
    {
      q: "광고 제거 외에 유튜브 프리미엄의 혜택은?",
      // 여기 있던 "YouTube Music 단독 구독(월 8,690원)"은 사실이 아니었다.
      // 8,690원은 한국 유튜브 프리미엄의 최초 출시가이며(아래 가격 변동 섹션 참조),
      // Music 단독 요금이 아니다. 확인 가능한 단독 요금을 이 저장소가 들고 있지 않으므로
      // 틀린 숫자를 다른 추정 숫자로 바꾸지 않고, 숫자 주장 자체를 뺀다.
      a: `광고 제거, 백그라운드 재생, 오프라인 저장, YouTube Music Premium 포함, 고품질 오디오(최대 256kbps)가 포함됩니다. YouTube Music Premium을 단독으로 구독할 때보다 요금은 높지만, 그 차액으로 유튜브 앱 전체의 광고 제거와 백그라운드 재생까지 함께 얻는 구조입니다. 단독 구독 요금은 이 페이지의 비교 대상이 아니어서 따로 싣지 않으니, 정확한 차액은 YouTube 공식 요금 안내에서 확인하세요.`,
    },
    {
      q: "VPN으로 다른 국가 가격으로 구독이 가능한가요?",
      a: `원칙적으로 불가능합니다. 가격은 VPN 위치가 아니라 Google 계정의 <strong>청구 국가</strong>와 <strong>결제 수단 발행 국가</strong>로 결정됩니다. VPN만 사용해서는 다른 국가의 가격을 볼 수 없으며, 강제로 변경하려 해도 결제가 거부되거나 향후 자동으로 재변경됩니다.`,
    },
    {
      // 질문을 "어떻게 공유하나요?"로 두면 한국에서 가입 가능하다는 전제가 깔린다.
      // 제공 여부를 먼저 묻는 형태로 바꿔 전제 자체를 없앤다.
      q: "한국에서도 가족 요금제로 나눠 낼 수 있나요?",
      a: `아니오. <strong>대한민국에서는 YouTube Premium 가족 요금제를 이용할 수 없습니다.</strong> ${FAMILY_PLAN_UNAVAILABLE_NOTE}. 한국 청구 국가로 설정된 계정으로는 가입도 공유도 불가능합니다. 가족 요금제가 제공되는 국가에서는 관리자가 <strong>같은 거주지 주소에 사는 가족 구성원을 최대 5명까지</strong> 초대할 수 있고, 주소가 다른 친구·지인과의 공유는 정책상 금지되어 감지 시 구성원이 제거될 수 있습니다. 따라서 한국 가족 요금제 가격이나 지인과의 분할 금액을 제시하는 안내는 사실과 다릅니다.`,
    },
    {
      q: "유튜브 프리미엄 라이트(Lite) 플랜이 뭔가요?",
      a: `Lite 플랜은 일부 국가에서만 제공되는 저가 요금제로, YouTube Music이 제외된 "광고 제거 전용" 플랜입니다. 저희가 확인한 ${liteRows.length}개국에서 개인 플랜 대비 ${pct1(Math.min(...liteRows.map((r) => r.ratio)) * 100)}~${pct1(Math.max(...liteRows.map((r) => r.ratio)) * 100)} 수준이고, 한국에서는 월 ${fmtWon(krLite)}에 이용할 수 있습니다.`,
    },
  ];
}

// 루트 허브 FAQ — "어떻게 비교하는가"(방법론)만 다룬다.
// 유튜브 프리미엄 페이지 FAQ("어떻게 싸게 구독하는가")와 주제가 겹치면
// 두 페이지가 다시 중복이 되므로 질문군을 의도적으로 분리한다.
function getLandingFaqItems() {
  const stats = computeCatalogStats();
  const data = stats.data;
  const rate = Number(data.krwRate);
  return [
    {
      q: "가격은 어떤 기준으로 비교하나요?",
      a: `각 국가의 <strong>개인(프리미엄) 플랜 월 요금</strong>을 기준으로 정렬합니다. 현지 통화 표시가를 그대로 싣고, 이를 미국 달러로 환산한 뒤 다시 원화로 환산해 같은 자에서 비교합니다. 표시가에 부가가치세가 포함되는지는 국가 제도에 따라 다르므로, 각 국가 상세 페이지에서 현지 통화 표시가를 함께 확인하는 편이 정확합니다.`,
    },
    {
      q: "환율은 어떤 값을 쓰나요?",
      a: `현재 적용 환율은 <strong>1 USD = ${Math.round(rate).toLocaleString("ko-KR")}원</strong>(기준일 ${data.exchangeRateDate})입니다. 환율은 공개 환율 API로 자동 갱신되고, 요금 자체는 사업자 공지를 확인한 뒤 수동으로 반영합니다. 가격 기준일과 환율 기준일이 다를 수 있어 두 날짜를 따로 표기합니다.`,
    },
    {
      q: "지금 비교할 수 있는 서비스는 무엇인가요?",
      // 예전 답은 "순차적으로 추가"를 약속하고 비교하지 않는 서비스를 "준비 중" 행으로 늘어놓았다.
      // 지키지 않은 약속이라 지운다 — 있는 것만 말한다.
      a: `현재는 유튜브 프리미엄 ${stats.countryCount}개국 요금을 비교합니다. 넷플릭스 등 다른 OTT는 국가별 요금제 구성이 서로 달라 같은 기준으로 정렬할 수 없어 싣지 않습니다.`,
    },
    {
      q: "전체 비교표와 국가 상세 페이지는 무엇이 다른가요?",
      a: `전체 비교표는 ${stats.pricedCount}개국을 한 화면에서 정렬·필터로 훑어보는 용도이고, 국가 상세 페이지는 한 국가의 개인·패밀리·듀오·라이트 요금제와 현지 통화 표시가, 같은 대륙 국가와의 비교를 모아 봅니다. 순위만 필요하면 전체 비교표, 특정 국가의 요금제 구성이 궁금하면 상세 페이지가 빠릅니다.`,
    },
  ];
}

function getCountryFaqItems(countryCode) {
  const data = loadData();
  const row = data.prices.find(
    (p) => String(p.countryCode || "").toLowerCase() === countryCode.toLowerCase()
  );
  if (!row) return [];

  const countryName = row.country;
  const surveyLabel = surveyCountryLabel(row) || `요금 조사 ${data.lastUpdated}`;
  return [
    {
      q: `${countryName} 가격으로 구독하려면 어떻게 해야 하나요?`,
      a: `Google 계정의 청구 국가를 ${countryName}으로 변경하고 해당 국가의 결제 수단을 등록해야 합니다. 단, 청구 국가 변경은 Google 정책상 1년에 1회만 가능하며, 변경 전 기존 구독을 취소하고 잔여 기간이 종료되어야 합니다.`,
    },
    {
      q: `VPN만 사용하면 ${countryName} 가격이 되나요?`,
      a: `아니오. 가격은 VPN이 아닌 "결제 수단 발행 국가"와 "Google 계정 청구 주소"로 결정됩니다. 한국 카드·주소로는 VPN을 사용해도 ${countryName} 가격을 볼 수 없습니다.`,
    },
    {
      q: `${countryName}에서 구독 후 한국에서도 이용 가능한가요?`,
      a: `유튜브 프리미엄은 전 세계 대부분의 국가에서 스트리밍 가능합니다. 다만 일부 국가에 영상 시청 지역 제한이 있을 수 있으며, 장기간 한국 IP에서 접속할 경우 Google이 실제 거주지를 재확인할 수 있습니다.`,
    },
    {
      q: `한국 신용카드로 ${countryName} 구독 결제가 가능한가요?`,
      a: `원칙적으로 Google 청구 국가와 카드 발행 국가가 일치해야 합니다. 한국 카드로 ${countryName} 가격 구독을 시도하면 결제 거부 또는 향후 청구 국가 자동 재변경이 발생할 수 있습니다.`,
    },
    {
      q: `${countryName} 가격은 자주 바뀌나요?`,
      a: `국가별 가격은 환율·물가·부가세 변동에 따라 조정되며, Google이 주기적으로 가격 정책을 재검토합니다. 본 페이지의 가격은 ${surveyLabel} 기준이며, 실제 결제 시점에 따라 다를 수 있으므로 Google Play·YouTube 공식 페이지에서 최종 확인하세요.`,
    },
  ];
}

// 트렌드 페이지 FAQ — 런타임 TrendsView.vue의 faqItems와 동일 문구를 유지한다
function getTrendsFaqItems() {
  const data = loadData();
  const fxDate = data.exchangeRateDate || data.lastUpdated || "-";
  const surveyDate = data.lastUpdated || "-";
  const rounds = D.surveyRounds(data);
  const recheckNote = rounds.recheckDate
    ? ` ${rounds.recheckDate}에 공식 출처로 다시 확인한 것은 ${rounds.recheckedCells}개 값뿐이라 국가별 시계열이 되지 못합니다.`
    : "";

  return [
    {
      q: "이 페이지에서 가격 변동 추이를 볼 수 있나요?",
      a: `아직 볼 수 없습니다. 변동을 보여주려면 같은 국가를 서로 다른 시점에 두 번 이상 조사한 이력이 있어야 하는데, 현재는 전수 요금 조사 1회분(${surveyDate} 기준)만 확보돼 있습니다.${recheckNote} 그래서 이 페이지는 시점 간 변동 대신 같은 시점의 국가 간 가격 격차를 보여줍니다. 두 번째 조사가 쌓이면 시점별 비교표가 이 자리에 나타납니다.`,
    },
    {
      q: "가격 데이터는 어떻게, 얼마나 자주 수집되나요?",
      a: `현지 통화 정가는 자동 수집 수단이 없어 사람이 조사해 반영합니다. 현재 요금 조사는 ${getSurveyProvenance()}입니다. 원화 환산에 쓰는 환율만 공개 환율 API에서 자동으로 가져오며 기준일은 ${fxDate}입니다. 실시간·일 단위 가격 시계열은 제공하지 않습니다.`,
    },
    {
      q: "과거 특정 시점의 공식 요금도 확인할 수 있나요?",
      a: "아니요. 본 페이지는 Google/YouTube의 공식 가격 변경 이력 아카이브가 아니며, 과거 요금 이력을 보관하고 있지 않습니다. 특정 시점의 공식 요금이나 인상 공지는 YouTube 고객센터 등 공식 채널에서 확인해야 정확합니다.",
    },
    {
      q: "환율이 바뀌면 순위도 바뀌나요?",
      // 이 표의 환율은 두 층이다: ①통화→달러(달러 환산가 안에 이미 굳어 있음)와
      // ②달러→원(전 국가 공통 배수 하나). 층을 구분하지 않으면 본문의
      // "환율이 움직여도 외국끼리 순위는 안 바뀐다"와 정면으로 부딪힌다.
      a: `환율이 어느 층에서 움직이는지에 따라 다릅니다. <strong>각국 통화의 대달러 환율</strong>이 움직이면 순위가 바뀝니다 — 현지 요금이 그대로여도 그 통화가 강세면 달러 환산가가 올라 순위가 밀립니다. 다만 이 표는 통화별 대달러 환율을 따로 들고 있지 않고 달러 환산가만 담고 있어서, 그 변화는 다음 요금 조사에서 한꺼번에 반영됩니다. 반대로 <strong>달러-원 환율</strong>은 모든 국가에 똑같이 곱해지는 배수 하나라, 그것만 움직이면 원화로 매겨진 한국의 자리만 옮겨지고 나머지 국가끼리의 순서는 바뀌지 않습니다. 순위와 함께 현지 통화 가격을 같이 확인하는 것이 안전합니다.`,
    },
  ];
}

// 화면용 FAQ 섹션 HTML (Qn. 접두어는 시각적 번호일 뿐, 스키마에는 질문 원문만 사용)
function buildFaqSectionHtml(items) {
  return items
    .map(
      (item, i) => `
      <h3 class="${H3}">Q${i + 1}. ${item.q}</h3>
      <p class="${P}">${item.a}</p>`
    )
    .join("");
}

// prerender.mjs가 FAQPage JSON-LD를 만들 때 사용하는 라우트별 FAQ 데이터.
// 반환이 빈 배열이면 해당 페이지에는 화면 FAQ가 없다는 뜻 → 스키마 주입 금지.
export function getFaqItems(route) {
  if (route === "/") {
    return getLandingFaqItems();
  }
  if (route === "/youtube-premium") {
    return getHomeFaqItems();
  }
  if (route === "/youtube-premium/trends") {
    return getTrendsFaqItems();
  }
  if (route.startsWith("/youtube-premium/")) {
    const code = route.split("/").at(-1);
    if (code && /^[a-z]{2}$/.test(code)) {
      return getCountryFaqItems(code);
    }
  }
  return [];
}

// =========================
// 국가별 페이지 (/youtube-premium/:code)
// =========================
function buildCountryContent(countryCode) {
  const data = loadData();
  const row = data.prices.find(
    (p) => String(p.countryCode || "").toLowerCase() === countryCode.toLowerCase()
  );
  if (!row) return null;

  const kr = data.prices.find((p) => p.countryCode === "KR");
  // 기준국(KRW)은 환산 없이 현지 정가 — 하드코딩 폴백(14897)은 왕복 오차의 화석이라 제거
  const krKrw = kr?.plans?.individual?.monthly ?? kr?.converted?.individual?.krw ?? null;
  const countryKrw = (row.currency === "KRW" ? row.plans?.individual?.monthly : null)
    ?? row.converted?.individual?.krw ?? null;
  const savings = countryKrw ? computeSavings(countryKrw, krKrw) : null;

  const countryName = row.country;
  const continent = getContinentLabel(row.continent);
  const currency = row.currency;
  const plans = row.plans || {};
  const converted = row.converted || {};

  // 플랜 목록
  const planRows = [];
  if (plans.individual) {
    planRows.push({
      name: "개인 플랜",
      local: `${Number(plans.individual.monthly).toLocaleString("ko-KR")} ${currency}`,
      krw: converted.individual?.krw,
      usd: converted.individual?.usd,
    });
  }
  if (plans.family) {
    planRows.push({
      name: "가족 플랜",
      local: `${Number(plans.family.monthly).toLocaleString("ko-KR")} ${currency}`,
      krw: converted.family?.krw,
      usd: converted.family?.usd,
    });
  }
  if (plans.duo) {
    planRows.push({
      name: "2인 플랜(Duo)",
      local: `${Number(plans.duo.monthly).toLocaleString("ko-KR")} ${currency}`,
      krw: converted.duo?.krw,
      usd: converted.duo?.usd,
    });
  }
  if (plans.student) {
    planRows.push({
      name: "학생 플랜",
      local: `${Number(plans.student.monthly).toLocaleString("ko-KR")} ${currency}`,
      krw: converted.student?.krw,
      usd: converted.student?.usd,
    });
  }
  if (plans.lite) {
    planRows.push({
      name: "Lite 플랜",
      local: `${Number(plans.lite.monthly).toLocaleString("ko-KR")} ${currency}`,
      krw: converted.lite?.krw,
      usd: converted.lite?.usd,
    });
  }

  // 소개 문장의 요금제 목록은 실제 planRows에서 만든다. 예전에는 "개인 플랜·가족 플랜·Lite 플랜"이
  // 하드코딩돼 있어, 가족 요금제가 없는 국가(대한민국 등)의 페이지에서도 있다고 말했다.
  const planNamesLabel = planRows.map((p) => p.name).join("·");

  const planRowsHtml = planRows
    .map(
      (p) =>
        `<tr>
          <td class="${TD}">${p.name}</td>
          <td class="${TD}">${p.local}</td>
          <td class="${TD}">${p.usd != null ? formatUsd(p.usd) : "-"}</td>
          <td class="${TD}">${p.krw != null ? formatKrw(p.krw) : "-"}</td>
        </tr>`
    )
    .join("");

  // 저장되는 돈 요약 문장
  const savingsSummary = savings
    ? savings.diff > 0
      ? `한국(${formatKrw(krKrw)})보다 월 <strong class="sp-down">${formatKrw(savings.diff)}</strong>(${savings.percent.toFixed(1)}%) 저렴하며, 연간 약 ${formatKrw(savings.annual)}을 절약할 수 있습니다.`
      : savings.diff < 0
        ? `한국(${formatKrw(krKrw)})보다 월 <strong class="sp-up">${formatKrw(-savings.diff)}</strong>(${Math.abs(savings.percent).toFixed(1)}%) 더 비쌉니다.`
        : `한국과 거의 동일한 가격입니다.`
    : "";

  // 국가마다 재확인 범위가 달라서 전역 날짜 하나로 쓰면 재확인 못 한 값까지 새 날짜로 읽힌다
  const surveyLabel = surveyCountryLabel(row) || `요금 조사 ${data.lastUpdated}`;
  const krwRate = data.krwRate ? `1 USD ≈ ${Math.round(data.krwRate).toLocaleString("ko-KR")}원` : "";

  return [
    // 뷰(CountryDetailView)가 국가명 h1과 요금제 카드를 라이브 데이터로 렌더한다
    {
      id: "country",
      live: true,
      html: `
      <nav aria-label="breadcrumb" class="sp-crumbs">
        <a href="/ott" class="sp-crumb">홈</a> ›
        <a href="/ott/youtube-premium" class="sp-crumb">유튜브 프리미엄</a> ›
        ${countryName}
      </nav>

      <h1 class="${H1}">유튜브 프리미엄 ${countryName} 가격 (${surveyLabel})</h1>

      <p class="${P}">
        유튜브 프리미엄 <strong>${countryName}</strong>(${continent}) 개인 플랜은
        현지 통화 기준 <strong>${planRows[0]?.local || "-"}</strong>이며,
        ${krwRate} 환율로 환산하면 월 <strong class="sp-down">${countryKrw != null ? formatKrw(countryKrw) : "-"}</strong>입니다.
        ${savingsSummary}
      </p>

      <p class="${P}">
        본 페이지는 ${countryName}에서 확인된 요금제${planNamesLabel ? `(${planNamesLabel})` : ""}의 가격 정보를 제공하며,
        한국 대비 절약률, VPN·지역 변경 우회 이용 시의 약관 위반 위험, 결제 시 주의사항을 함께 안내합니다.
        확인되지 않은 요금제는 표와 본문 어디에도 싣지 않습니다.
      </p>

      <h2 class="${H2}">1. ${countryName} 유튜브 프리미엄 요금제 전체</h2>
      ${planRows.length > 0
        ? `<div class="sp-table-scroll"><table class="${TABLE}">
            <thead>
              <tr>
                <th class="${TH}">플랜</th>
                <th class="${TH}">현지 가격</th>
                <th class="${TH}">USD 환산</th>
                <th class="${TH}">원화 환산</th>
              </tr>
            </thead>
            <tbody>${planRowsHtml}</tbody>
          </table></div>`
        : `<p class="${P}">이 국가의 상세 요금제 정보가 아직 수집되지 않았습니다.</p>`
      }

      <p class="sp-note sp-note--tight">
        ※ ${krwRate} 기준. 환율은 매일 변동하므로 실제 결제 금액은 해당 통화 원가 × 현재 환율로 계산됩니다.
        ${surveyLabel} · 환율 기준일: ${data.exchangeRateDate}
      </p>

`,
    },
    {
      id: "country-guide",
      live: false,
      html: `      <h2 class="${H2}">2. 한국 대비 가격 비교</h2>
      ${savings
        ? `<div class="sp-table-scroll"><table class="${TABLE}">
            <tbody>
              <tr>
                <td class="${TD}">한국 개인 플랜(원화)</td>
                <td class="${TD}">${formatKrw(krKrw)}</td>
              </tr>
              <tr>
                <td class="${TD}">${countryName} 개인 플랜(원화)</td>
                <td class="${TD}">${formatKrw(countryKrw)}</td>
              </tr>
              <tr class="${savings.diff > 0 ? "sp-row--down" : "sp-row--up"}">
                <td class="${TD}"><strong>${savings.diff > 0 ? "월 절약액" : "월 추가 부담"}</strong></td>
                <td class="${TD}"><strong>${formatKrw(Math.abs(savings.diff))} (${Math.abs(savings.percent).toFixed(1)}%)</strong></td>
              </tr>
              <tr>
                <td class="${TD}">연간 ${savings.diff > 0 ? "절약액" : "추가 부담"}</td>
                <td class="${TD}">${formatKrw(Math.abs(savings.annual))}</td>
              </tr>
            </tbody>
          </table></div>`
        : ""
      }

      ${savings && savings.diff > 0
        ? `<div class="${INFO}">
            <strong>절약 포인트</strong> — ${countryName} 요금으로 1년 구독 시 한국 요금 대비 약 ${formatKrw(savings.annual)}을 절약할 수 있습니다.
            단, 결제 수단과 거주지 인증 등의 제약이 있으므로 아래 "이용 시 주의사항"을 반드시 확인하세요.
          </div>`
        : ""
      }

      <h2 class="${H2}">3. 국가별 가격 차이가 생기는 이유</h2>
      <p class="${P}">
        유튜브 프리미엄은 국가별로 구매력 평가(PPP)·물가·환율·세금·현지 경쟁 환경을 반영해 차등 가격 정책을 운영합니다.
        인도·튀르키예·아르헨티나·이집트·베트남·인도네시아 등 개발도상국은 한국 대비 30~80% 저렴한 가격으로 제공되며,
        반대로 미국·영국·스위스·노르웨이 등 고소득 국가는 한국보다 비싼 경우가 많습니다.
      </p>
      <ul class="${UL}">
        <li class="${LI}"><strong>구매력 평가(PPP)</strong>: 현지 평균 소득에 비례한 가격</li>
        <li class="${LI}"><strong>부가가치세(VAT)</strong>: 국가별 세율이 0~25%로 상이</li>
        <li class="${LI}"><strong>환율 변동</strong>: 달러 강세 시 원화 기준 가격 상승</li>
        <li class="${LI}"><strong>현지 경쟁 서비스</strong>: 넷플릭스·스포티파이 등과 경쟁 가격 책정</li>
      </ul>

      <h2 class="${H2}">4. 이용 시 주의사항 (약관 위반 위험)</h2>
      <div class="${CALLOUT}">
        <strong>⚠️ YouTube 이용약관 안내</strong><br>
        Google/YouTube 이용약관에 따르면, 구독자는 "현재 거주지"의 가격을 지불해야 합니다.
        VPN·결제 수단을 이용해 다른 국가의 가격으로 구독하는 것은 이용약관 위반으로 간주될 수 있으며,
        Google이 이를 감지하면 구독 취소·환불 거부·계정 정지 등의 조치가 취해질 수 있습니다.
      </div>
      <p class="${P}">
        다음 상황에서만 ${countryName} 가격을 합법적으로 이용할 수 있습니다.
      </p>
      <ul class="${UL}">
        <li class="${LI}">${countryName}에 실제 거주하거나 장기 체류 중인 경우</li>
        <li class="${LI}">${countryName} 국적·비자를 가진 외국인 노동자·유학생</li>
        <li class="${LI}">${countryName} 현지 결제 수단(은행 계좌·신용카드)을 보유한 경우</li>
        <li class="${LI}">업무·여행 목적으로 해당 국가에서 일시 체류 중인 경우</li>
      </ul>

      <h2 class="${H2}">5. 자주 묻는 질문 (FAQ)</h2>
      ${buildFaqSectionHtml(getCountryFaqItems(countryCode))}

      <h2 class="${H2}">6. 다른 저렴한 국가 비교</h2>
      <ul class="${UL}">
        <li class="${LI}"><a href="/ott/youtube-premium/in">인도 (세계 최저가)</a></li>
        <li class="${LI}"><a href="/ott/youtube-premium/tr">튀르키예</a></li>
        <li class="${LI}"><a href="/ott/youtube-premium/ar">아르헨티나</a></li>
        <li class="${LI}"><a href="/ott/youtube-premium/vn">베트남</a></li>
        <li class="${LI}"><a href="/ott/youtube-premium/id">인도네시아</a></li>
        <li class="${LI}"><a href="/ott/youtube-premium">전체 국가 가격 비교</a></li>
      </ul>

      <p class="sp-note">
        ※ 본 페이지의 현지 통화 요금은 ${surveyLabel} 기준 자료이고, 원화 환산에 쓴 환율은 ${data.exchangeRateDate} 기준입니다. 실제 Google Play/YouTube 공식 가격과 다를 수 있습니다.
        가격 우회 구독은 약관 위반 위험이 있어 권장하지 않습니다. 본 사이트는 Google 또는 YouTube의 공식 제휴 서비스가 아닙니다.
      </p>`,
    },
  ];
}

// =========================
// 정적 페이지별 콘텐츠
// =========================

// =========================
// 루트 허브 (/) — 서비스 디렉터리 + 비교 방법론
//
// The root used to reuse buildHomeContent() verbatim, which made "/" and
// "/youtube-premium" byte-identical (1.00 similarity, same <title>). The root
// now covers what the runtime HomeView actually shows -- the service catalogue
// -- plus the comparison methodology, so the two URLs no longer compete.
// =========================
// =========================
// 데이터 파생 관찰 — 44개국 자체 조사 시드를 전수로 훑어 나온 사실만 싣는다.
//
// 세 페이지가 같은 시드를 쓰므로 축을 명확히 나눈다. 축이 겹치면 세 URL이
// 서로의 중복 콘텐츠가 되고, 그건 "같은 글을 세 번 실은 것"과 구분되지 않는다.
//   /                        → 데이터가 무엇으로 이루어져 있는가(커버리지·요금제·통화·표기)
//   /youtube-premium         → 국가 사이의 가격 구조(군집·역전·손익분기)
//   /youtube-premium/trends  → 환산과 환율이 순위에 미치는 영향(견고성)
//
// 숫자는 한 개도 하드코딩하지 않는다. 전부 seo-discoveries.mjs가 시드에서 계산한다.
// 시드가 갱신되면 산문의 숫자는 따라 움직이지만 "서술"은 따라 움직이지 않으므로,
// 리터럴 앵커 테스트(scripts/seo-discoveries.test.mjs)가 먼저 red가 되게 해 뒀다.
// =========================

const pct1 = (value) => `${Number(value).toFixed(1)}%`;
const num = (value) => Number(value).toLocaleString("ko-KR");
// 환율 같은 고정밀 값은 기본 toLocaleString이 소수 3자리에서 잘라 버린다(1,385.742).
// 시드 원값을 그대로 보여야 "달러값 × 이 수 = 원화값"이라는 검산이 재현된다.
const numExact = (value) =>
  Number(value).toLocaleString("ko-KR", { maximumFractionDigits: 8 });
const density = (value) => Number(value).toFixed(1);
// 0.02%처럼 작은 비율은 소수 1자리로 찍으면 "0.0%"가 돼 문장이 거짓말을 한다
const pct2 = (value) => `${Number(value).toFixed(2)}%`;

/**
 * 받침 유무 판정 — 조사(이/가, 은/는, 와/과, 을/를)를 데이터에서 온 단어에 붙이기 위한 것.
 * 국가명·숫자가 시드에서 오므로 조사를 고정하면 데이터가 바뀔 때 "홍콩가"처럼 깨진다.
 * 숫자는 한국어 발음 기준(0영·1일·3삼·6육·7칠·8팔은 받침, 2이·4사·5오·9구는 없음).
 */
function hasFinalConsonant(word) {
  const ch = String(word).trim().slice(-1);
  if (/[0-9]/.test(ch)) return ["0", "1", "3", "6", "7", "8"].includes(ch);
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  return false;
}

/** josa("홍콩", "이", "가") → "홍콩이" / josa("싱가포르", "이", "가") → "싱가포르가" */
function josa(word, withFinal, withoutFinal) {
  return `${word}${hasFinalConsonant(word) ? withFinal : withoutFinal}`;
}

/**
 * 두 비율을 "A~B%" 범위로 쓴다. 양 끝이 갈라지는 가장 짧은 자릿수(0→1→2)를 고른다.
 *
 * 왜: 메인 문서가 "한국 가격의 15~15% 수준"이라고 썼다(인도 14.5%·튀르키예 15.4%가 정수 반올림에서
 * 같은 값으로 뭉개졌다). 자릿수를 고정하면 시드가 바뀔 때마다 같은 사고가 다시 난다.
 * 두 값이 정말 같으면 범위가 아니므로 "약 X%" 하나로 쓴다.
 */
export function formatShareRange(lowRatio, highRatio) {
  const [lo, hi] = [lowRatio, highRatio].map((r) => r * 100).sort((a, b) => a - b);
  for (const digits of [0, 1, 2]) {
    const a = lo.toFixed(digits);
    const b = hi.toFixed(digits);
    if (a !== b) return `${a}~${b}%`;
  }
  return `약 ${lo.toFixed(0)}%`;
}

/** 루트 허브: 데이터의 생김새 — 커버리지·요금제·통화·표기 관습. */
function buildLandingDatasetSection() {
  const data = loadData();
  const coverage = D.planCoverage(data);
  const currency = D.currencyStructure(data);
  const notation = D.notationConventions(data);
  const audit = D.conversionAudit(_rawPriceSeed);
  const lite = D.litePlans(data);
  const continents = D.continentStats(data);
  const gapDays = D.surveyDateGapDays(data);
  const billing = D.billingPeriodCoverage(data);
  const denom = D.savingsDenominatorAsymmetry(data);
  const services = loadServices().services || [];
  const declaredPlans = services.find((s) => s.id === data.serviceId)?.plans || [];
  const declaredCells = coverage.countryCount * declaredPlans.length;
  const eurozone = currency.shared[0] || null;
  const continentText = continents
    .slice()
    .sort((a, b) => b.count - a.count)
    .map((c) => `${getContinentLabel(c.continent)} ${c.count}개국`)
    .join(" · ");
  const topTwo = continents.slice().sort((a, b) => b.count - a.count).slice(0, 2);
  const topTwoCount = topTwo.reduce((sum, c) => sum + c.count, 0);
  const smallest = continents.slice().sort((a, b) => a.count - b.count)[0];
  const planLabel = new Map(declaredPlans.map((plan) => [plan.id, plan.name]));
  const planOrder = declaredPlans.map((plan) => plan.id);
  const comboRows = D.planCombinations(data).map((combo) => ({
    ...combo,
    // 조합 라벨은 등록부가 선언한 순서(프리미엄 → 패밀리 → …)로 읽는다.
    // 내부 키는 정렬된 id 문자열이라 그대로 쓰면 "패밀리 + 프리미엄"처럼 뒤집혀 보인다.
    label: [...combo.ids]
      .sort((a, b) => planOrder.indexOf(a) - planOrder.indexOf(b))
      .map((id) => planLabel.get(id) || id)
      .join(" + "),
  }));
  const liteRankText = lite.members.map((m) => `${m.rank}위 ${m.country}`).join(" · ");

  return `      <h2 class="${H2}">이 요금표를 전수로 훑어 나온 것들</h2>
      <p class="${P}">
        아래는 저희가 직접 조사한 ${coverage.countryCount}개국 요금표를 한 칸도 빼지 않고 세어서 얻은 관찰입니다.
        바깥에서 가져온 통계가 아니라 이 표 자체의 성질입니다. 요금 자료의 시점은 ${getSurveyProvenance()}입니다.
        아래 숫자는 문장에 적어 둔 것이 아니라 빌드할 때 저장소에 커밋된 시드에서 계산합니다 —
        요금표가 갱신되면 이 글의 수치도 같이 바뀝니다.
      </p>

      <h3 class="${H3}">요금제 칸 ${declaredCells}개 중 ${coverage.cells}개만 차 있습니다</h3>
      <p class="${P}">
        서비스 등록부는 이 서비스에 ${declaredPlans.length}가지 요금제(${declaredPlans.map((p) => p.name).join(" · ")})를 선언합니다.
        ${coverage.countryCount}개국 × ${declaredPlans.length}가지 = ${declaredCells}칸인데 실제로 값이 있는 칸은 ${coverage.cells}개(${pct1((coverage.cells / declaredCells) * 100)})뿐입니다.
        개인 플랜만 ${coverage.counts.individual}개국 전부에 있고, 패밀리는 ${coverage.counts.family}개국,
        라이트는 ${coverage.counts.lite}개국, 듀오는 ${coverage.counts.duo}개국에만 있습니다.
        이 사이트의 모든 순위가 개인 플랜 기준인 것은 취향이 아니라,
        ${coverage.countryCount}개국을 한 줄에 세울 수 있는 요금제가 그것 하나뿐이기 때문입니다.
      </p>

      <h3 class="${H3}">패밀리가 없는 나라는 딱 한 곳이고, 하필 기준 국가입니다</h3>
      <p class="${P}">
        ${coverage.counts.family}개국에 패밀리 요금이 있고 빠진 나라는 ${coverage.missingFamily.join(" · ")} 하나입니다.
        ${coverage.missingFamily[0]}이 절약률의 기준선이라 결과가 조금 이상해집니다 —
        개인 플랜은 "${coverage.missingFamily[0]} 대비 몇 % 싼가"를 말할 수 있지만,
        패밀리는 비교할 기준값 자체가 없어 절약률을 만들 수 없습니다.
        가격표에서 요금제를 패밀리로 바꾸면 절약률 배지가 사라지는 이유가 이것입니다.
      </p>

      <h3 class="${H3}">라이트는 가격대 양 끝에만 있습니다</h3>
      <p class="${P}">
        음악 서비스를 뺀 저가 플랜인 라이트를 제공하는 나라는 ${coverage.counts.lite}곳입니다.
        개인 요금이 싼 순으로 세우면 ${liteRankText}입니다.
        ${lite.gapStart}위부터 ${lite.gapEnd}위까지 ${lite.gapLength}개국이 연속으로 라이트를 갖고 있지 않습니다.
        저가 플랜이 가격 부담을 낮추기 위한 것이라면 중간 가격대에 가장 촘촘해야 할 텐데,
        이 데이터에서는 정확히 그 구간이 비어 있고 최저가권 ${lite.members.filter((m) => m.rank <= lite.gapStart).length}개국과
        고가권 ${lite.members.filter((m) => m.rank > lite.gapEnd).length}개국에만 몰려 있습니다.
      </p>

      <h3 class="${H3}">환율을 거치지 않고 비교할 수 있는 조합은 ${num(currency.totalPairs)}쌍 중 ${currency.sameCurrencyPairs}쌍뿐</h3>
      <p class="${P}">
        ${coverage.countryCount}개국이 쓰는 통화는 ${currency.currencyCount}종입니다.
        두 나라 이상이 함께 쓰는 통화는 ${eurozone ? `${eurozone.currency} 하나(${eurozone.countries.length}개국)` : "없고"}뿐이고,
        나머지 ${currency.soloCurrencyCount}개 통화는 각각 한 나라만 씁니다.
        나라를 둘씩 짝지으면 ${num(currency.totalPairs)}쌍인데, 그중 통화가 같아 정가를 그대로 견줄 수 있는 조합은 ${currency.sameCurrencyPairs}쌍입니다.
        나머지 ${num(currency.convertedPairs)}쌍은 예외 없이 환산을 한 번 거치며, 그 환산에는 요금 조사일이 아니라
        환율 기준일(${data.exchangeRateDate})의 값이 들어갑니다.
      </p>

      <h3 class="${H3}">정가 표기에도 나라마다 관습이 있습니다</h3>
      <p class="${P}">
        ${coverage.countryCount}개국 현지 정가 중 ${notation.lastDigitNine}개국은 마지막 자리가 9입니다.
        소수점을 쓰는 나라가 ${notation.decimals}개국이고 그중 ${notation.decimal99}개국은 .99로 끝납니다.
        정수만 쓰는 나라는 ${notation.integers}개국인데, 한국(${num(14900)}원)·일본·베트남·인도네시아처럼
        최소 화폐 단위가 커서 소수점이 쓰이지 않는 통화가 여기 포함됩니다.
        그래서 "9로 끝나니 할인가"처럼 읽으면 안 됩니다 — 끝자리 9는 국가별 표기 관습이지 가격 수준의 정보가 아닙니다.
      </p>

      <h3 class="${H3}">표의 원화 값은 관측이 아니라 계산 결과입니다</h3>
      <p class="${P}">
        요금표의 환산 칸 ${audit.checked}개를 전부 검산하면 예외 없이
        "달러값 × ${numExact(audit.rate)}을 반올림한 값"과 일치합니다(불일치 ${audit.mismatches.length}건).
        원화 열은 각 나라에서 원화로 관측한 값이 아니라 달러값의 함수라는 뜻입니다.
        기준 국가도 같은 파이프라인을 타기 때문에, 원화로 매겨진 정가가 왕복 환산을 거치면
        ${audit.roundTrip.map((r) => `${num(r.local)}원 → ${num(r.derived)}원`).join(", ")}으로 어긋납니다.
        그래서 화면과 정적 HTML은 원화 표시 국가에 한해 환산값 대신 현지 정가를 되돌려 씁니다.
      </p>

      <h3 class="${H3}">요금 날짜와 환율 날짜를 따로 적는 이유</h3>
      <p class="${P}">
        요금 조사일 ${data.lastUpdated}과 환율 기준일 ${data.exchangeRateDate}은 ${gapDays}일 떨어져 있습니다.
        ${surveyScopeSentence(data)}
        환율 기준일은 그 정가를 원화로 바꾸는 배수를 가져온 날입니다.
        성격이 다른 관측이라 하나로 묶어 "데이터 기준일"이라고 적으면 어느 한쪽은 반드시 거짓이 됩니다.
        이 사이트가 요금 날짜와 환율 날짜를 어디서나 따로 표기하는 이유입니다.
      </p>

      <h3 class="${H3}">연 단위 요금은 ${billing.cells}칸이 전부 비어 있습니다</h3>
      <p class="${P}">
        요금제 칸 하나에는 월 요금과 연 요금 두 자리가 있습니다.
        월 요금은 ${billing.monthly}칸이 전부 채워져 있는데, 연 요금이 채워진 칸은 ${billing.yearly}개입니다.
        그래서 이 사이트의 어떤 순위도 연간 결제 할인을 반영하지 않습니다.
        일부 국가에서 연간 결제가 월 결제보다 싼 것으로 알려져 있지만, 저희 조사가 그 값을 담고 있지 않으므로
        "연간으로 결제하면 얼마"라는 계산은 여기서 하지 않습니다.
        표에 없는 것을 있는 것처럼 계산하면 그 순간부터 순위표 전체를 믿을 수 없게 됩니다.
      </p>

      <h3 class="${H3}">같은 격차가 ${pct1(denom.cheaperPercentFromBase)}로도 ${pct1(denom.pricierPercentFromCheapest)}로도 읽힙니다</h3>
      <p class="${P}">
        이 사이트의 절약률은 전부 한국을 분모로 씁니다.
        그래서 ${denom.cheapest.country} ${formatKrw(denom.cheapest.krw)}은 "한국보다 ${pct1(denom.cheaperPercentFromBase)} 싸다"로 표시됩니다.
        같은 두 값을 ${denom.cheapest.country} 쪽에서 보면 한국은 "${denom.cheapest.country}보다 ${pct1(denom.pricierPercentFromCheapest)} 비싸다"가 됩니다.
        가격 차이는 하나인데 퍼센트는 ${pct1(denom.cheaperPercentFromBase)} 대 ${pct1(denom.pricierPercentFromCheapest)},
        ${(denom.pricierPercentFromCheapest / denom.cheaperPercentFromBase).toFixed(1)}배로 벌어집니다.
      </p>
      <p class="${P}">
        분모가 다르기 때문이지 계산이 틀린 것이 아닙니다.
        절약률은 구조상 100%를 넘을 수 없고(요금이 0원이 되어야 100%입니다), 인상률에는 상한이 없습니다.
        이 표에서 가장 싼 나라와 가장 비싼 나라를 절약률로 재면 최대 ${pct1(denom.maxSavingsPercent)}지만,
        같은 두 나라를 인상률로 재면 ${pct1(denom.maxMarkupPercent)}입니다.
        그래서 절약률만 보면 국가 사이 격차가 실제보다 작아 보입니다.
        표의 퍼센트는 "한국을 기준으로 얼마나 아끼는가"로만 읽으시고,
        나라와 나라를 견줄 때는 퍼센트가 아니라 금액 자체를 보는 편이 안전합니다.
      </p>

      <h3 class="${H3}">"세계 최저가"가 아니라 "이 표의 최저가"입니다</h3>
      <p class="${P}">
        이 표에 실린 ${coverage.countryCount}개국은 이 서비스가 제공되는 모든 나라가 아니라 저희가 직접 확인한 나라입니다.
        따라서 표의 최저·최고는 조사 범위 안에서의 최저·최고이고, 표에 없는 나라에 대해서는 아무 말도 하지 않습니다.
        국가 코드는 ${coverage.countryCount}개가 전부 서로 다른 두 자리 코드라 같은 나라가 두 줄로 들어간 경우는 없지만,
        빠진 나라가 있을 가능성은 언제나 열려 있습니다.
      </p>

      <h3 class="${H3}">이 데이터로 답할 수 있는 질문과 없는 질문</h3>
      <p class="${P}">
        지금 확보한 것은 ${coverage.countryCount}개국 × 1시점 = ${coverage.countryCount}개 관측입니다.
        "어느 나라가 더 싼가"는 ${num(currency.totalPairs)}쌍 전부에 답할 수 있습니다 — 같은 시점끼리의 비교이기 때문입니다.
        반면 "어느 나라가 올랐나"에 답하려면 같은 나라를 서로 다른 날짜에 두 번 이상 조사한 기록이 필요한데,
        그 조건을 채운 나라는 현재 0개국입니다. 그래서 이 사이트는 어느 페이지에서도 시점 간 가격 변동을 표시하지 않습니다.
      </p>

      <h3 class="${H3}">표본은 대륙별로 고르지 않습니다</h3>
      <p class="${P}">
        수록 국가를 대륙으로 나누면 ${continentText}입니다.
        ${josa(getContinentLabel(topTwo[0].continent), "과", "와")} ${getContinentLabel(topTwo[1].continent)}가 ${coverage.countryCount}개국 중 ${topTwoCount}개국(${pct1((topTwoCount / coverage.countryCount) * 100)})이라,
        이 표의 "전체 평균"은 사실상 그 두 대륙의 평균에 가깝습니다.
        반대쪽 끝에는 ${getContinentLabel(smallest.continent)}처럼 국가 수가 ${smallest.count}개뿐인 대륙이 있어,
        그 평균은 한두 나라가 통째로 결정합니다.
        대륙 분류 자체도 데이터 제공자의 선택입니다 — 이 표는 튀르키예를 유럽으로 넣었고,
        대륙 필터의 결과는 그 선택을 그대로 물려받습니다.
      </p>

      <h3 class="${H3}">${coverage.countryCount}개국이 보이는 요금제 조합은 ${comboRows.length}가지뿐입니다</h3>
      <p class="${P}">
        나라마다 어떤 요금제를 갖고 있는지를 조합으로 묶으면 ${comboRows.length}가지가 나옵니다.
        "${comboRows[0].label}" 조합이 ${comboRows[0].countries.length}개국(${pct1((comboRows[0].countries.length / coverage.countryCount) * 100)})에 이르고,
        나머지 ${comboRows.slice(1).reduce((sum, r) => sum + r.countries.length, 0)}개국이 ${comboRows.length - 1}가지로 흩어집니다.
        ${declaredPlans.length}가지를 모두 갖춘 나라는 ${comboRows.find((r) => r.ids.length === declaredPlans.length)?.countries.join(" · ") || "없습니다"} 한 곳뿐이고,
        패밀리 없이 라이트만 있는 나라도 ${comboRows.find((r) => r.ids.join("+") === "individual+lite")?.countries.join(" · ") || "-"} 한 곳뿐입니다.
      </p>
      <div class="sp-table-scroll"><table class="${TABLE}">
        <thead>
          <tr>
            <th class="${TH}">요금제 조합</th>
            <th class="${TH}">국가 수</th>
            <th class="${TH}">해당 국가</th>
          </tr>
        </thead>
        <tbody>${comboRows
          .map(
            (r) => `<tr>
            <td class="${TD}">${r.label}</td>
            <td class="${TD}">${r.countries.length}개국</td>
            <td class="${TD}">${r.countries.length > 6 ? `${r.countries.slice(0, 6).join(" · ")} 외 ${r.countries.length - 6}개국` : r.countries.join(" · ")}</td>
          </tr>`
          )
          .join("")}</tbody>
      </table></div>

      <h3 class="${H3}">"개인 플랜"은 서비스마다 다른 물건을 가리킵니다</h3>
      <p class="${P}">
        서비스 등록부에는 ${services.length}개 서비스가 올라와 있고 그중 비교 가능한 것은 ${services.filter((x) => x.active).length}개입니다.
        나머지를 순위표에 넣지 않는 이유는 데이터를 못 구해서가 아니라 축이 맞지 않아서입니다.
        등록부의 individual 자리에 들어가는 상품이 서비스마다 다르기 때문입니다 —
        ${services
          .filter((x) => (x.plans || []).some((plan) => plan.id === "individual"))
          .slice(0, 4)
          .map((x) => `${x.name} "${x.plans.find((plan) => plan.id === "individual").name}"`)
          .join(", ")}처럼 서로 다른 상품이 같은 슬롯을 씁니다.
        같은 슬롯 이름이 서비스마다 다른 상품을 가리키므로, 서비스를 가로질러 "개인 플랜끼리" 정렬하면
        서로 다른 물건의 가격을 한 줄에 세우게 됩니다. 지금 순위표가 한 서비스 안에서만 그려지는 이유입니다.
      </p>

`;
}

/** 서비스 가격표: 국가 사이의 가격 구조 — 군집·역전·손익분기. */
function buildHomeStructureSection() {
  const data = loadData();
  const spread = D.globalSpread(data);
  const bands = D.usdBandDensity(data);
  const neighborhood = D.baseNeighborhood(data);
  const gaps = D.adjacentGaps(data);
  const continents = D.continentStats(data);
  const family = D.familyMultiples(data);
  const reversalsAll = D.familyRankReversals(data);
  const eurozone = D.eurozoneContrast(data);
  const eurozoneNames = eurozone.members.map((m) => m.country);
  const reversals = D.familyRankReversals(data, eurozoneNames);
  const split = D.familySplitThresholds(data);
  const lite = D.litePlans(data);
  const duo = D.duoPlans(data);

  const bandLow = bands.find((b) => b.lo === 5);
  const bandMid = bands.find((b) => b.lo === 10);
  const bandHigh = bands.find((b) => b.lo === 15);
  const africa = continents.find((c) => c.continent === "africa");
  const northAmerica = continents.find((c) => c.continent === "north-america");
  const europe = continents.find((c) => c.continent === "europe");
  const asia = continents.find((c) => c.continent === "asia");
  const nearestUp = neighborhood.within[0];
  const bigGaps = gaps.big;
  const upperBig = bigGaps.filter((g) => g.fromKrw >= neighborhood.baseKrw)[0];
  const heads4 = split.levels.find((l) => l.heads === 4);
  const heads3 = split.levels.find((l) => l.heads === 3);
  const liteOutlier = lite.minRatio;
  const liteRest = lite.members.filter((m) => m.country !== liteOutlier.country);
  const liteBase = lite.members.find((m) => m.code === String(data.baseCountry).toUpperCase());
  const duoVsFamily = duo.filter((x) => x.vsFamily != null).map((x) => x.vsFamily);
  // 원화 반올림이 배수를 정확히 2.000으로 보이게 만드는 사례를 데이터에서 찾는다.
  // 나라 이름을 고정하면 시드가 바뀔 때 문장이 사례 없는 주장을 하게 된다.
  const indiaLike =
    family.rows.find((r) => {
      const row = data.prices.find((p) => p.country === r.country);
      return (
        r.multiple !== 2 &&
        row?.converted?.family?.krw === row?.converted?.individual?.krw * 2
      );
    }) || family.rows[0];
  const indiaRow = data.prices.find((p) => p.country === indiaLike.country);
  const indiaKrw = {
    individual: indiaRow.converted.individual.krw,
    family: indiaRow.converted.family.krw,
  };
  const topReversal = reversals.top[0];
  const secondReversal = reversals.top.find(
    (p) => p.a.country !== topReversal.a.country && p.b.country !== topReversal.b.country
  );

  return `      <h2 class="${H2}">${data.prices.length}개국 표를 전수로 계산해 본 결과</h2>
      <p class="${P}">
        아래 수치는 위 가격표를 그대로 계산해 얻은 것입니다.
        요금 자료의 시점은 ${getSurveyProvenance()}이며, 시점 간 가격 변동은 다루지 않습니다.
      </p>

      <h3 class="${H3}">격차는 ${spread.spread}배지만 가격대가 연속이지는 않습니다</h3>
      <p class="${P}">
        최저 ${spread.cheapest.country} ${formatKrw(spread.cheapest.krw)}, 최고 ${spread.priciest.country} ${formatKrw(spread.priciest.krw)}로 ${spread.spread}배 차이가 납니다.
        그런데 그 사이가 고르게 채워져 있지 않습니다. 달러 기준으로
        ${bandLow.lo}~${bandLow.hi}달러 구간에 ${bandLow.count}개국(달러당 ${density(bandLow.density)}개국),
        ${bandHigh.lo}~${bandHigh.hi}달러 구간에 ${bandHigh.count}개국(달러당 ${density(bandHigh.density)}개국)이 몰려 있는데,
        그 사이 ${bandMid.lo}~${bandMid.hi}달러 구간은 ${bandMid.count}개국(달러당 ${density(bandMid.density)}개국)으로 양옆보다 성깁니다.
        가격대는 두 덩어리이고 그 사이에 골짜기가 있습니다.
      </p>

      <h3 class="${H3}">한국은 그 골짜기 안, 그것도 아래쪽 벽에 붙어 있습니다</h3>
      <p class="${P}">
        한국 ${formatKrw(neighborhood.baseKrw)}은 ${neighborhood.total}개국 중 싼 순 ${neighborhood.rankAsc}위입니다.
        ±${Math.round(neighborhood.tolerance * 100)}% 안에 든 나라는
        ${neighborhood.within.map((r) => `${r.country}(${formatKrw(r.krw)})`).join(" · ")} ${neighborhood.within.length}곳인데
        ${neighborhood.cheaperWithin.length === 0 ? "전부 한국보다 비쌉니다" : `그중 ${neighborhood.cheaperWithin.length}곳만 한국보다 쌉니다`}.
        한국보다 싼 나라 중 가장 가까운 곳은 ${neighborhood.nearestCheaper.country}(${formatKrw(neighborhood.nearestCheaper.krw)})로 ${Math.abs(neighborhood.nearestCheaperGapPercent)}% 아래입니다.
        바로 위와는 ${num(nearestUp.krw - neighborhood.baseKrw)}원 차이인데 바로 아래와는 ${num(neighborhood.baseKrw - neighborhood.nearestCheaper.krw)}원 차이 —
        한국의 자리는 위쪽으로만 붙어 있습니다.
      </p>

      <h3 class="${H3}">"한 단계 위 나라"가 조금 비싼 게 아닙니다</h3>
      <p class="${P}">
        순위상 바로 옆 나라와의 가격 차이가 10%를 넘는 지점이 ${bigGaps.length}군데 있습니다.
        가장 큰 계단은 ${bigGaps[0].from}(${formatKrw(bigGaps[0].fromKrw)}) → ${bigGaps[0].to}(${formatKrw(bigGaps[0].toKrw)}) ${pct1(bigGaps[0].percent)},
        그다음이 ${bigGaps[1].from}(${formatKrw(bigGaps[1].fromKrw)}) → ${bigGaps[1].to}(${formatKrw(bigGaps[1].toKrw)}) ${pct1(bigGaps[1].percent)}입니다.
        한국보다 비싼 쪽에서 가장 큰 계단은 ${upperBig.from} → ${upperBig.to} ${pct1(upperBig.percent)}입니다.
        표에서 한 칸 위로 올라가는 비용은 자리에 따라 이렇게 다릅니다.
      </p>

      <h3 class="${H3}">대륙 평균은 무엇을 가립니까</h3>
      <p class="${P}">
        ${getContinentLabel(africa.continent)} ${africa.count}개국의 평균은 ${formatKrw(africa.mean)}인데 중앙값은 ${formatKrw(africa.median)}입니다.
        평균이 중앙값의 ${pct1(africa.meanOverMedian * 100)}밖에 안 됩니다 —
        ${africa.cheapest}(${formatKrw(africa.min)})처럼 아주 싼 나라가 평균을 끌어내렸기 때문입니다.
        반대로 ${getContinentLabel(northAmerica.continent)}는 평균 ${formatKrw(northAmerica.mean)}이 중앙값 ${formatKrw(northAmerica.median)}의 ${pct1(northAmerica.meanOverMedian * 100)}입니다.
        대륙 평균만 보면 ${getContinentLabel(africa.continent)}는 실제보다 싸 보이고 ${getContinentLabel(northAmerica.continent)}는 비싸 보입니다.
      </p>

      <h3 class="${H3}">대륙을 알아도 가격대는 거의 좁혀지지 않습니다</h3>
      <p class="${P}">
        ${getContinentLabel(europe.continent)} ${europe.count}개국 안의 격차는 ${europe.spread}배(${europe.cheapest} ${formatKrw(europe.min)} ~ ${europe.priciest} ${formatKrw(europe.max)})로,
        ${getContinentLabel(asia.continent)} ${asia.count}개국의 ${asia.spread}배보다 큽니다.
        전체 격차가 ${spread.spread}배인데 ${getContinentLabel(europe.continent)} 한 대륙이 그 대부분을 덮습니다.
        "${getContinentLabel(europe.continent)}은 비싸다"는 요약이 ${europe.cheapest}에서 무너지므로,
        대륙 필터는 가격대를 좁히는 도구가 아니라 지역을 고르는 도구로 쓰셔야 합니다.
      </p>

      <h3 class="${H3}">패밀리가 개인의 정확히 두 배인 나라는 한 곳도 없습니다</h3>
      <p class="${P}">
        패밀리를 제공하는 ${family.count}개국에서 패밀리÷개인 배수를 현지 통화로 계산하면
        ${family.min.country} ${family.min.multiple}배(${num(family.min.individualLocal)} → ${num(family.min.familyLocal)} ${family.min.currency})에서
        ${family.max.country} ${family.max.multiple}배(${num(family.max.individualLocal)} → ${num(family.max.familyLocal)} ${family.max.currency})까지 흩어집니다.
        정확히 2.000배인 나라는 ${family.exactlyTwo}곳이고, 2보다 작은 나라가 ${family.underTwo}곳, 큰 나라가 ${family.overTwo}곳입니다.
      </p>
      <p class="${P}">
        이 배수를 원화 환산값으로 재면 안 됩니다.
        예를 들어 ${josa(indiaLike.country, "은", "는")} 현지 통화로 ${num(indiaLike.individualLocal)} → ${num(indiaLike.familyLocal)} ${indiaLike.currency}, 배수 ${indiaLike.multiple}입니다.
        같은 값을 원화로 옮기면 ${formatKrw(indiaKrw.individual)} → ${formatKrw(indiaKrw.family)}, 정확히 두 배로 보입니다.
        반올림이 만든 착시입니다.
      </p>

      <h3 class="${H3}">"둘이 나눠 쓰면 이득"이 참인 나라는 ${family.breakEvenTwo}곳입니다</h3>
      <p class="${P}">
        패밀리가 개인 요금 N개분보다 싸지려면 N이 배수보다 커야 합니다.
        배수가 2 미만인 ${family.breakEvenTwo}개국에서는 2명부터 패밀리가 유리하고,
        2를 넘는 ${family.breakEvenThree}개국에서는 3명이 모여야 유리해집니다.
        같은 서비스인데 "둘이 나눠 쓰면 이득"이라는 조언의 참·거짓이 나라에 따라 갈립니다.
      </p>

      <h3 class="${H3}">개인 순위와 패밀리 순위가 뒤집히는 조합이 ${reversalsAll.count}쌍</h3>
      <p class="${P}">
        개인 요금은 A가 싼데 패밀리는 A가 비싼 조합을 전수로 세면 ${reversalsAll.count}쌍입니다.
        ${josa(topReversal.a.country, "은", "는")} 개인 ${formatKrw(topReversal.a.individual)}로 ${topReversal.b.country} ${formatKrw(topReversal.b.individual)}보다 ${num(topReversal.b.individual - topReversal.a.individual)}원 쌉니다.
        그런데 패밀리는 ${topReversal.a.country} ${formatKrw(topReversal.a.family)}, ${topReversal.b.country} ${formatKrw(topReversal.b.family)}로 ${num(topReversal.a.family - topReversal.b.family)}원 비쌉니다.
        ${josa(secondReversal.a.country, "과", "와")} ${secondReversal.b.country}도 개인은 ${formatKrw(secondReversal.a.individual)} 대 ${formatKrw(secondReversal.b.individual)}인데
        패밀리에서는 ${formatKrw(secondReversal.a.family)} 대 ${formatKrw(secondReversal.b.family)}로 뒤집힙니다.
        개인 플랜 순위표를 보고 패밀리를 고르면 틀릴 수 있습니다.
      </p>

      <h3 class="${H3}">환율을 완전히 지워도 역전은 남습니다</h3>
      <p class="${P}">
        유로를 쓰는 ${eurozone.members.length}개국은 통화가 같아 환산 효과가 0인 구간입니다.
        개인 요금은 ${eurozone.individualGroups.map((g) => `${g.countries.join("·")} ${g.price}유로`).join(", ")}로 갈리고,
        패밀리는 ${eurozone.familyGroups.map((g) => `${g.countries.join("·")} ${g.price}유로`).join(", ")}로 갈립니다.
        개인이 싼 ${eurozone.cheapGroup.map((m) => m.country).join("·")}가 패밀리에서는 더 비쌉니다.
        환율도 반올림도 개입하지 않은 상태에서 순위가 뒤집히므로,
        앞의 ${reversalsAll.count}쌍은 환산 탓이 아니라 가격 정책 자체에서 나온다고 봐야 합니다.
      </p>

      <h3 class="${H3}">${heads4.heads}명이 나누면 ${heads4.passing}개국 전부가 한국보다 싸고, ${heads3.heads}명이면 무너집니다</h3>
      <p class="${P}">
        패밀리 요금을 ${heads4.heads}명이 똑같이 나눈다고 하면, 패밀리를 제공하는 ${split.total}개국 전부에서
        1인당 부담이 한국 개인 요금 ${formatKrw(split.baseKrw)}보다 낮습니다.
        가장 비싼 ${heads4.worst.country}조차 ${num(heads4.worst.family)} ÷ ${heads4.heads} = ${formatKrw(heads4.worstPerHead)}입니다.
        그런데 ${heads3.heads}명으로 내리면 ${split.total}개국 중 ${heads3.passing}개국으로 줄어듭니다 —
        ${heads3.failing.join(" · ")}가 한국 위로 올라갑니다.
        "패밀리를 나누면 어디든 이득"은 ${heads4.heads}명까지만 참입니다.
      </p>
      <div class="${INFO}">
        위 계산은 한 가구 안에서 요금을 나눌 때의 산술입니다.
        패밀리 요금제는 약관상 같은 가구 구성원만 이용할 수 있고, 인원 한도도 서비스 약관을 따릅니다.
        모르는 사람과 나누는 용도로 계산한 값이 아닙니다.
      </div>

      <h3 class="${H3}">요금제를 바꾸면 나라 사이 격차가 거의 사라집니다</h3>
      <p class="${P}">
        개인 요금만 보면 ${liteOutlier.country}(${formatKrw(liteOutlier.individual)})는 한국(${formatKrw(liteBase.individual)})의 ${(liteOutlier.individual / liteBase.individual).toFixed(2)}배입니다.
        그런데 두 나라가 모두 제공하는 라이트로 비교하면 ${liteOutlier.country} ${formatKrw(liteOutlier.lite)} 대 한국 ${formatKrw(liteBase.lite)}, 배수는 ${(liteOutlier.lite / liteBase.lite).toFixed(2)}입니다.
        ${liteOutlier.country}의 라이트÷개인 비율이 ${pct1(liteOutlier.ratio * 100)}로 낮은 반면,
        라이트를 제공하는 나머지 ${liteRest.length}개국은 ${pct1(Math.min(...liteRest.map((m) => m.ratio)) * 100)}~${pct1(Math.max(...liteRest.map((m) => m.ratio)) * 100)}에 몰려 있기 때문입니다.
        "${josa(liteOutlier.country, "은", "는")} 비싸다"는 판단이 요금제를 바꾸는 순간 거의 사라집니다.
      </p>

      <h3 class="${H3}">듀오는 ${duo.length}개국뿐이고 전부 2인분의 4분의 3 언저리입니다</h3>
      <p class="${P}">
        2인용인 듀오 요금이 있는 나라는 ${duo.map((x) => x.country).join(" · ")} ${duo.length}곳입니다.
        개인 요금 2개분 대비 ${duo.map((x) => `${x.country} ${pct1(x.vsTwoSolo * 100)}`).join(" · ")}로
        네 나라가 모두 4분의 3 근처에 모여 있습니다.
        그런데 같은 나라들의 듀오÷패밀리는 ${pct1(Math.min(...duoVsFamily) * 100)}~${pct1(Math.max(...duoVsFamily) * 100)}로 훨씬 넓게 흩어집니다 —
        듀오 가격은 개인 요금에 붙어 움직이고 패밀리 가격은 따로 움직인다는 뜻입니다.
      </p>

`;
}

/** 트렌드: 환산과 환율이 순위에 미치는 영향 — 순위가 얼마나 견고한가. */
function buildTrendsFxSection() {
  const data = loadData();
  const fx = D.fxRankThresholds(data);
  const invariance = D.orderingInvariance(data);
  const collisions = D.numeralCollisions(data);
  const ties = D.krwTies(data);
  const gapDays = D.surveyDateGapDays(data);
  const neighborhood = D.baseNeighborhood(data);
  const foreignCount = data.prices.length - 1;

  const down = fx.crossings.filter((c) => c.deltaPercent < 0);
  const up = fx.crossings.filter((c) => c.deltaPercent > 0);
  const nearestDown = down[down.length - 1];
  const nearestUp = up[0];
  const deadZoneStart = down[down.length - 3];
  const deadZoneEnd = down[down.length - 4];
  const audit = D.conversionAudit(_rawPriceSeed);
  const roundTrip = audit.roundTrip.find((r) => r.planId === "individual") || audit.roundTrip[0];
  const magnitude = D.numeralMagnitudeContrast(data);
  const span = D.fxRankScenarios(data, [-20, 20]);
  const spanLow = span[0];
  const spanHigh = span[1];
  const tightest = collisions[collisions.length - 1];
  const widest = collisions[0];
  const midCollision = collisions.find(
    (c) => c !== tightest && c !== widest && c.entries.length > 2
  );

  const thresholdRows = fx.within20
    .map(
      (c) => `<tr>
          <td class="${TD}">${c.country}</td>
          <td class="${TD}">${num(c.rateNeeded)}원</td>
          <td class="${TD}"><strong class="${c.deltaPercent < 0 ? "sp-down" : "sp-up"}">${c.deltaPercent > 0 ? "+" : ""}${c.deltaPercent}%</strong></td>
          <td class="${TD}">${c.rankAfter}위</td>
        </tr>`
    )
    .join("");

  return `      <h2 class="${H2}">환율이 이 순위를 얼마나 흔드는가</h2>
      <div class="${INFO}">
        <strong>가정 시나리오입니다</strong> — 아래는 "환율이 다른 값이었다면 이 표의 순위가 어떻게 달라졌을까"를
        계산한 결과이지, 환율이 실제로 그렇게 움직였다는 관측이 아닙니다.
        전수 요금 조사는 여전히 1회분(${data.lastUpdated} 기준 ${data.prices.length}개국)${
          D.surveyRounds(data).recheckDate
            ? `이고 그 뒤 공식 출처 재확인은 ${D.surveyRounds(data).recheckedCells}개 값뿐이며`
            : "뿐이며"
        },
        아래 어떤 문장도 특정 국가의 요금이 바뀌었다고 말하지 않습니다.
      </div>

      <h3 class="${H3}">이 표에서 "환율"은 두 층입니다</h3>
      <p class="${P}">
        원화 값이 나오기까지 환율이 두 번 개입합니다.
        ① <strong>각국 통화 → 달러</strong> — 통화마다 다른 값이고, 표의 달러 환산가 안에 이미 굳어 있습니다.
        ② <strong>달러 → 원</strong> — ${foreignCount}개국 전부에 똑같이 곱해지는 배수 하나(1 ${data.baseCurrency} = ${numExact(data.krwRate)}원)입니다.
        아래에서 "환율이 움직인다"고 할 때는 ②만 가리킵니다.
        ①이 움직이면 순위는 당연히 바뀝니다. 다만 이 표는 통화별 대달러 환율을 따로 들고 있지 않아,
        그 변화는 다음 요금 조사에서 달러 환산가가 통째로 갱신될 때 한꺼번에 반영됩니다.
      </p>

      <h3 class="${H3}">②만 움직이면 외국끼리의 순서는 바뀌지 않습니다</h3>
      <p class="${P}">
        원화 값은 외국 ${foreignCount}개국 전부가 같은 배수를 곱한 결과입니다.
        모두에게 같은 양수를 곱하면 대소 관계가 보존되므로, 환율이 얼마나 움직이든 외국끼리의 순위는 한 자리도 바뀌지 않습니다.
        위의 "저렴한 국가 상위 10위" 명단은 환율에 대해 그대로입니다.
        실제로 원화로 정렬한 순서와 달러로 정렬한 순서를 ${data.prices.length}개국 전부에서 맞춰 보면 어긋나는 자리가 ${invariance.mismatchCount}건입니다 —
        화면의 통화 토글은 표시 단위만 바꿀 뿐 순위를 바꾸지 않습니다.
        아래 시나리오는 전부 ② 하나만 움직였을 때의 이야기입니다.
      </p>

      <h3 class="${H3}">움직이는 것은 기준 국가의 자리 하나뿐입니다</h3>
      <p class="${P}">
        한국만 정가가 원화(${formatKrw(fx.baseKrw)})로 매겨져 있어 환율에 고정되어 있습니다.
        환율이 움직이면 나머지 ${foreignCount}개국이 한꺼번에 위아래로 미끄러지고, 한국은 제자리에서 그 흐름을 스쳐 보냅니다.
        그래서 "환율이 순위에 미치는 영향"은 사실상 "한국이 몇 번째 자리에 놓이는가" 하나의 문제로 줄어듭니다.
      </p>

      <h3 class="${H3}">그 자리는 한쪽으로만 예민합니다 — ${fx.asymmetryRatio}배 비대칭</h3>
      <p class="${P}">
        지금 한국은 싼 순 ${neighborhood.rankAsc}위입니다.
        환율이 ${Math.abs(nearestDown.deltaPercent)}%만 내려가도(${numExact(fx.rate)}원 → ${num(nearestDown.rateNeeded)}원)
        ${nearestDown.country}(${formatKrw(nearestDown.krw)})가 한국보다 싸져 ${nearestDown.rankAfter}위로 밀립니다.
        반대로 한 계단 올라가려면 ${nearestUp.country}(${formatKrw(nearestUp.krw)})를 추월해야 하는데 ${nearestUp.deltaPercent}% 상승이 필요합니다.
        같은 "한 계단"인데 필요한 환율 변화량이 ${fx.asymmetryRatio}배 차이 납니다.
        한국이 자기 가격대 군집의 바닥에 붙어 있기 때문입니다.
      </p>

      <h3 class="${H3}">그다음에는 순위가 멈춰 있는 구간이 나옵니다</h3>
      <p class="${P}">
        원화가 계속 강해진다고 가정하면 ${josa(down[down.length - 2].country, "이", "가")} ${Math.abs(down[down.length - 2].deltaPercent)}%에서,
        ${josa(deadZoneStart.country, "이", "가")} ${Math.abs(deadZoneStart.deltaPercent)}%에서 한국을 앞지릅니다. 여기까지가 ${deadZoneStart.rankAfter}위입니다.
        그런데 다음 한 계단(${deadZoneEnd.country})까지는 ${Math.abs(deadZoneEnd.deltaPercent)}%가 필요합니다.
        즉 ${Math.abs(deadZoneStart.deltaPercent)}%와 ${Math.abs(deadZoneEnd.deltaPercent)}% 사이
        약 ${(Math.abs(deadZoneEnd.deltaPercent) - Math.abs(deadZoneStart.deltaPercent)).toFixed(1)}%p 구간에서는
        환율이 아무리 흔들려도 한국이 ${deadZoneStart.rankAfter}위에 그대로 있습니다.
        순위표의 민감도는 구간마다 이렇게 다릅니다.
      </p>

      <h3 class="${H3}">±20% 안에서 순위가 바뀌는 지점은 ${fx.within20.length}곳</h3>
      <div class="sp-table-scroll"><table class="${TABLE}">
        <thead>
          <tr>
            <th class="${TH}">추월/피추월 국가</th>
            <th class="${TH}">임계 환율</th>
            <th class="${TH}">지금 대비</th>
            <th class="${TH}">지나면 한국 순위</th>
          </tr>
        </thead>
        <tbody>${thresholdRows}</tbody>
      </table></div>
      <p class="sp-note sp-note--tight">
        ※ 임계 환율은 한국 정가 ${formatKrw(fx.baseKrw)}을 각국 달러 표시가로 나눈 값입니다.
        환율 예측이 아니라 "지금 순위가 얼마나 견고한가"를 재는 눈금입니다.
      </p>
      <p class="${P}">
        40%p 폭 안에서 순위가 바뀌는 사건은 ${fx.within20.length}번뿐이고, 그 ${fx.within20.length}번 모두 한국이 당사자입니다.
        나머지 ${foreignCount}개국은 서로의 자리를 한 번도 바꾸지 않습니다.
      </p>
      <p class="${P}">
        정리하면, 환율이 지금보다 ${Math.abs(spanLow.percent)}% 낮았다면 한국은 ${spanLow.rank}위,
        ${spanHigh.percent}% 높았다면 ${spanHigh.rank}위였을 것입니다.
        ±${Math.abs(spanLow.percent)}%라는 큰 폭을 다 써도 한국이 놓일 수 있는 자리는 ${Math.min(spanHigh.rank, spanLow.rank)}위에서 ${Math.max(spanHigh.rank, spanLow.rank)}위까지 ${Math.abs(spanLow.rank - spanHigh.rank) + 1}칸이고,
        외국끼리 자리를 바꾸는 횟수는 그동안에도 0번입니다.
        이 순위표에서 환율이 할 수 있는 일의 전부가 이 두 숫자입니다.
      </p>

      <h3 class="${H3}">표시된 숫자가 같다는 사실은 아무것도 말해주지 않습니다</h3>
      <p class="${P}">
        현지 정가 표시가 ${tightest.numeral}인 나라가 둘 있습니다 —
        ${tightest.entries.map((e) => `${e.country}(${e.currency})`).join(", ")}. 원화로는
        ${tightest.entries.map((e) => formatKrw(e.krw)).join(" 대 ")}, ${tightest.spread}배 차이입니다.
        표시가가 ${widest.numeral}인 나라도 둘 있습니다 —
        ${widest.entries.map((e) => `${e.country}(${e.currency})`).join(", ")}. 이쪽은 원화로
        ${widest.entries.map((e) => formatKrw(e.krw)).join(" 대 ")}, ${widest.spread}배 차이입니다.
        ${midCollision ? `표시가 ${josa(midCollision.numeral, "은", "는")} ${midCollision.entries.length}개국·${new Set(midCollision.entries.map((e) => e.currency)).size}개 통화에 걸쳐 나타나며 ${formatKrw(Math.min(...midCollision.entries.map((e) => e.krw)))}부터 ${formatKrw(Math.max(...midCollision.entries.map((e) => e.krw)))}까지 ${midCollision.spread}배로 벌어집니다.` : ""}
        같은 숫자가 ${tightest.spread}배 차이도 되고 ${widest.spread}배 차이도 되므로,
        표시가만 보고 나라를 고르는 판단은 성립하지 않습니다.
      </p>
      <p class="${P}">
        크기 순서도 마찬가지입니다. 현지 표시가를 숫자 크기로만 줄 세우면 맨 앞은
        ${magnitude.smallest.map((r) => `${r.country}(${r.local} ${r.currency})`).join(" · ")}인데,
        원화 순위로는 ${magnitude.total}개국 중 ${magnitude.smallest.map((r) => `${r.rank}위`).join(" · ")}입니다 — 비싼 쪽입니다.
        맨 뒤는 ${magnitude.largest.country}(${num(magnitude.largest.local)} ${magnitude.largest.currency})인데 원화 순위는 ${magnitude.largest.rank}위, 싼 쪽입니다.
        표시가의 크기 순서와 실제 부담의 순서가 거의 반대로 놓입니다.
      </p>

      <h3 class="${H3}">원화 동률 ${ties.tiedCountries}개국은 전부 진짜 동률입니다</h3>
      <p class="${P}">
        원화 환산값이 같은 나라 묶음이 ${ties.ties.length}개 있습니다 —
        ${ties.ties.map((t) => `${formatKrw(t.krw)} ${t.members.map((m) => m.country).join("·")}`).join(", ")}.
        ${ties.ties.every((t) => t.genuine) ? `${ties.ties.length}개 묶음 모두 현지 정가 자체가 같은 금액(${ties.ties.map((t) => `${t.members[0].local} ${t.members[0].currency}`).join(", ")})이라 진짜 동률입니다.` : "일부는 현지 정가가 다른데 같은 값으로 보입니다."}
        달러값을 소수 둘째 자리로 반올림하는 과정 때문에 서로 다른 정가가 같은 원화 값으로 뭉친 사례는
        개인 요금 ${data.prices.length}개국에서 ${ties.artificial}건입니다.
        순위표의 공동 순위는 환산 해상도의 부산물이 아닙니다.
      </p>

      <h3 class="${H3}">환산 반올림 오차와 순위 경계는 같은 자릿수에 있습니다</h3>
      <p class="${P}">
        한국 정가를 달러로 바꿨다가 되돌리면 ${num(roundTrip.local)}원이 ${num(roundTrip.derived)}원이 됩니다.
        ${num(Math.abs(roundTrip.local - roundTrip.derived))}원, ${pct2((Math.abs(roundTrip.local - roundTrip.derived) / roundTrip.local) * 100)}의 오차입니다.
        그런데 바로 위 칸인 ${nearestDown.country}와의 간격은 ${num(nearestDown.krw - fx.baseKrw)}원뿐이라,
        왕복 오차가 순위 경계 간격의 ${pct1((Math.abs(roundTrip.local - roundTrip.derived) / (nearestDown.krw - fx.baseKrw)) * 100)}에 해당합니다.
        환산 해상도와 순위 경계가 같은 자릿수에 있다는 뜻입니다.
      </p>
      <p class="${P}">
        다만 이 사례에서 보정 여부가 순위를 바꾸지는 않습니다.
        보정을 걷어낸 ${num(roundTrip.derived)}원도 ${nearestDown.country} ${formatKrw(nearestDown.krw)}보다 싸서 자리는 ${neighborhood.rankAsc}위 그대로입니다.
        그래도 이 사이트가 원화 표시 국가에 한해 현지 정가를 되돌려 쓰는 이유는,
        간격이 ${num(nearestDown.krw - fx.baseKrw)}원인 자리에서는 다음 갱신에 순서를 뒤집을 수 있는 크기이기 때문입니다.
      </p>

      <h3 class="${H3}">두 날짜의 시차가 흔드는 것과 흔들지 못하는 것</h3>
      <p class="${P}">
        요금 조사일 ${data.lastUpdated}과 환율 기준일 ${data.exchangeRateDate} 사이에는 ${gapDays}일이 있습니다.
        그 사이 환율만 달라졌다면, 위의 첫 번째 관찰에 따라 외국 ${foreignCount}개국 사이의 순위는 한 자리도 바뀌지 않고
        한국의 자리만 움직입니다. 시차가 실제로 흔들 수 있는 것은 그 하나입니다.
      </p>
      <p class="${P}">
        반대로 그 사이 어느 나라의 현지 정가가 바뀌었는지는 ${
          D.surveyRounds(data).recheckDate
            ? `${D.surveyRounds(data).recheckDate}에 공식 출처로 다시 확인한 ${D.surveyRounds(data).recheckedCells}개 값(그중 ${D.surveyRounds(data).updatedCells}개는 값이 달라 갱신)을 빼면 `
            : ""
        }이 데이터로는 알 수 없습니다.
        나머지 값은 정가 관측이 1회분뿐이라 비교 대상이 없기 때문입니다.
        그래서 이 페이지는 변동률을 싣지 않고, 대신 "지금 순위가 얼마나 견고한가"만 위와 같이 정량화합니다.
      </p>
      <p class="sp-note">
        ※ 이 절에서 말한 "민감도"는 환율에 대한 민감도이며, 각국 요금 자체의 변동과는 아무 관계가 없습니다.
        임계 환율은 순위가 뒤집히는 지점을 재는 눈금일 뿐 환율 전망이 아닙니다.
      </p>

`;
}

function buildLandingContent() {
  const stats = computeCatalogStats();
  const data = stats.data;
  const services = loadServices().services || [];
  const rate = Number(data.krwRate);

  // 비교할 수 있는 서비스만 싣는다. 비활성 서비스를 "준비 중" 행으로 늘어놓으면 허브가
  // 없는 기능의 목록이 된다(외부 점검 2026-09-27) — 등록부(data/services.json)는 그대로 둔다.
  const serviceRowsHtml = services
    .filter((service) => service.active)
    .map((service) => {
      const planNames = (service.plans || []).map((plan) => plan.name).join(" · ");
      const nameCell = `<a href="/ott/${service.slug}">${service.name}</a>`;
      const coverage = `${stats.countryCount}개국`;
      const status = '<strong class="sp-down">비교 가능</strong>';
      return `<tr>
          <td class="${TD}">${nameCell}</td>
          <td class="${TD}">${status}</td>
          <td class="${TD}">${coverage}</td>
          <td class="${TD}">${planNames}</td>
        </tr>`;
    })
    .join("");

  const spreadText = stats.spread ? `${stats.spread.toFixed(1)}배` : "-";

  return [{ id: "landing", live: false, html: `
      <h1 class="${H1}">OTT 구독료 국가별 가격 비교</h1>

      <!-- 첫 화면 도입은 두 줄까지만 둔다. 예전에는 세 문장짜리 두 문단(약 280자)이 서비스 표를
           밀어내 390px 첫 화면이 전부 안내 문장이었다. 나머지 문장은 지우지 않고 표 바로 아래로 옮겼다. -->
      <p class="${P}">
        같은 OTT 서비스라도 어느 나라 계정으로 결제하느냐에 따라 청구되는 금액이 크게 달라집니다.
      </p>

      <h2 class="${H2}">비교할 수 있는 서비스</h2>
      <div class="sp-table-scroll"><table class="${TABLE}">
        <thead>
          <tr>
            <th class="${TH}">서비스</th>
            <th class="${TH}">상태</th>
            <th class="${TH}">수록 국가</th>
            <th class="${TH}">요금제 구성</th>
          </tr>
        </thead>
        <tbody>${serviceRowsHtml}</tbody>
      </table></div>

      <p class="${P}">
        이곳은 그 차이를 <strong>같은 기준으로 환산해</strong> 확인할 수 있도록 만든 비교 서비스의 시작 페이지입니다.
        어떤 서비스를 비교할 수 있는지, 가격을 어떤 방식으로 환산하는지, 어느 페이지부터 보면 되는지를 안내합니다.
      </p>

      <p class="${P}">
        나라별 요금표 자체가 필요하다면 곧바로 <a href="/ott/youtube-premium">유튜브 프리미엄 전체 가격 비교</a>로 이동하세요.
        이 페이지는 <em>비교 기준과 데이터 출처</em>를 설명하는 안내 페이지이며, 순위표는 각 서비스 페이지에 있습니다.
      </p>

      <h2 class="${H2}">이 비교가 다루지 않는 것</h2>
      <ul class="${UL}">
        <li class="${LI}"><strong>다른 구독 서비스</strong> — ${services.filter((service) => !service.active).map((service) => service.name).join("·")}는 서비스 등록부에는 있지만
          광고형·연간 결제·학생 요금처럼 요금제 구성이 서비스와 나라마다 달라 "개인 플랜"끼리 한 줄에 세울 수 없습니다. 그래서 순위표에 싣지 않습니다.</li>
        <li class="${LI}"><strong>실시간 가격</strong> — 요금은 조사일(${data.lastUpdated}) 기준 정가입니다. 그 뒤 바뀐 요금은 다음 조사 전까지 반영되지 않고,
          환율만 기준일(${data.exchangeRateDate})에 맞춰 갱신합니다.</li>
        <li class="${LI}"><strong>해외 요금으로 가입하는 방법</strong> — 요금은 결제 수단 발행 국가와 계정 청구 국가로 정해지고,
          대부분의 약관은 실제 거주 국가의 요금을 요구합니다. 다른 나라 요금으로 가입하는 방법은 안내하지 않습니다.</li>
      </ul>

      <h2 class="${H2}">가격을 환산하는 방식</h2>
      <p class="${P}">
        모든 순위는 <strong>개인(프리미엄) 플랜의 월 요금</strong>을 기준으로 계산합니다.
        현지 통화 표시가를 먼저 수집하고, 기준 통화인 ${data.baseCurrency}로 환산한 뒤 다시 원화로 환산해 한 줄에 나란히 놓습니다.
        연 단위로만 판매되는 요금제는 월 환산값을 별도로 표기하며, 표시가에 부가가치세가 포함되는지는 국가 제도에 따라 다릅니다.
      </p>
      <ul class="${UL}">
        <li class="${LI}"><strong>가격 기준일</strong> — ${getSurveyProvenance()} (요금 자체는 사람이 조사해 수동 반영)</li>
        <li class="${LI}"><strong>환율 기준일</strong> — ${data.exchangeRateDate} (공개 환율 API로 자동 갱신)</li>
        <li class="${LI}"><strong>적용 환율</strong> — 1 ${data.baseCurrency} = ${Math.round(rate).toLocaleString("ko-KR")}원</li>
        <li class="${LI}"><strong>기준 국가</strong> — ${data.baseCountry === "KR" ? "한국" : data.baseCountry} (절약률은 한국 가격 대비로 계산)</li>
      </ul>

      <h2 class="${H2}">현재 수록된 데이터</h2>
      <div class="sp-table-scroll"><table class="${TABLE}">
        <tbody>
          <tr>
            <th class="${TH}">수록 국가</th>
            <td class="${TD}">${stats.countryCount}개국 (${stats.continentCount}개 대륙)</td>
          </tr>
          <tr>
            <th class="${TH}">한국 개인 플랜</th>
            <td class="${TD}">${stats.krKrw != null ? formatKrw(stats.krKrw) : "-"}</td>
          </tr>
          <tr>
            <th class="${TH}">가장 저렴한 국가</th>
            <td class="${TD}">${stats.cheapest ? `${stats.cheapest.country} — ${formatKrw(stats.cheapest.krw)}` : "-"}</td>
          </tr>
          <tr>
            <th class="${TH}">가장 비싼 국가</th>
            <td class="${TD}">${stats.priciest ? `${stats.priciest.country} — ${formatKrw(stats.priciest.krw)}` : "-"}</td>
          </tr>
          <tr>
            <th class="${TH}">최저-최고 격차</th>
            <td class="${TD}">${spreadText}</td>
          </tr>
        </tbody>
      </table></div>

      <h2 class="${H2}">요금제와 용어</h2>
      <ul class="${UL}">
        <li class="${LI}"><strong>개인(프리미엄)</strong> — 1인 사용 기본 플랜. 모든 순위·절약률의 기준값입니다.</li>
        <li class="${LI}"><strong>패밀리</strong> — 같은 가구 구성원이 함께 쓰는 플랜. 인원 한도는 서비스 약관을 따릅니다.</li>
        <li class="${LI}"><strong>듀오</strong> — 2인용 플랜. 제공 국가가 제한적이라 빈칸인 국가가 많습니다.</li>
        <li class="${LI}"><strong>라이트</strong> — 음악 서비스가 빠진 저가 플랜. 제공 국가에서만 표기됩니다.</li>
        <li class="${LI}"><strong>청구 국가</strong> — 결제 수단 발행 국가와 계정 청구 주소로 정해지는 값. 접속 위치가 아니라 이 값이 가격을 결정합니다.</li>
      </ul>

${buildLandingDatasetSection()}
      <h2 class="${H2}">어디부터 보면 되나요</h2>
      <ul class="${UL}">
        <li class="${LI}"><a href="/ott/youtube-premium">전체 국가 가격 비교</a> — ${stats.pricedCount}개국 순위표와 정렬·필터</li>
        <li class="${LI}"><a href="/ott/youtube-premium/trends">국가 간 가격 격차</a> — 환율이 순위를 얼마나 흔드는지까지</li>
        <li class="${LI}"><a href="/ott/youtube-premium/kr">한국 가격 상세</a> — 기준 국가의 요금제별 표시가</li>
        <li class="${LI}"><a href="/ott/about">서비스 소개와 데이터 출처</a> — 수집·검증 절차</li>
      </ul>

      <h2 class="${H2}">자주 묻는 질문 (FAQ)</h2>
      ${buildFaqSectionHtml(getLandingFaqItems())}

      <div class="${CALLOUT}">
        <strong>⚠️ 가격 정보 제공 목적입니다</strong><br>
        여기 실린 국가별 가격은 각국 정가를 그대로 옮긴 정보이며, 우회 결제를 안내하는 자료가 아닙니다.
        대부분의 사업자 약관은 실제 거주 국가의 요금 지불을 요구하며, 위반 시 구독 취소·환불 거부 등의 불이익이 있을 수 있습니다.
      </div>

      <p class="sp-note">
        ※ 본 서비스는 Google LLC·YouTube 및 각 OTT 사업자의 공식 제휴 서비스가 아닙니다. 요금 조사: ${getSurveyProvenance()}.
      </p>` }];
}

function buildHomeContent() {
  const data = loadData();
  const prices = data.prices
    .filter((p) => p.converted?.individual?.krw)
    .map((p) => ({ ...p, krw: p.converted.individual.krw }))
    .sort((a, b) => a.krw - b.krw);
  const kr = data.prices.find((p) => p.countryCode === "KR");
  const krKrw = kr?.plans?.individual?.monthly ?? kr?.converted?.individual?.krw ?? null;

  const planCounts = D.planCoverage(data).counts;
  const top20 = prices.slice(0, 20);
  const rowsHtml = top20
    .map(
      (p, i) => {
        const savingsPercent = ((krKrw - p.krw) / krKrw * 100).toFixed(1);
        return `<tr>
          <td class="${TD}">${i + 1}위</td>
          <td class="${TD}"><a href="/ott/youtube-premium/${p.countryCode.toLowerCase()}">${p.country}</a>${
            surveyCellMark(p, "individual") ? ` <span class="sp-survey-mark">${surveyCellMark(p, "individual").text}</span>` : ""
          }</td>
          <td class="${TD}">${formatKrw(p.krw)}</td>
          <td class="${TD}"><strong class="sp-down">-${savingsPercent}%</strong></td>
        </tr>`;
      }
    )
    .join("");

  return [
    // 뷰(ServicePriceView)가 h1과 정렬·필터되는 라이브 가격표를 렌더한다
    {
      id: "home",
      live: true,
      html: `
      <h1 class="${H1}">유튜브 프리미엄 국가별 가격 비교 (${surveyHeadline(data)})</h1>

      <p class="${P}">
        전 세계 <strong>${prices.length}개 국가</strong>의 유튜브 프리미엄(YouTube Premium) 개인 플랜 가격을 한눈에 비교하는 서비스입니다.
        한국은 현재 월 <strong>${formatKrw(krKrw)}</strong>(부가세 포함)이지만, 이 표에서 가장 낮은 나라는
        <strong class="sp-down">${prices[0].country} ${formatKrw(prices[0].krw)}</strong>입니다.
        각 국가의 가격 차이, 한국 대비 절약률을 환율 기준일(${data.exchangeRateDate}) 시점의 환율로 환산해 제공합니다.
      </p>

      <p class="${P}">
        유튜브 프리미엄은 광고 제거·백그라운드 재생·오프라인 저장·YouTube Music Premium까지 포함한 종합 구독 서비스입니다.
        같은 기능·같은 품질이지만 Google이 국가별 구매력·물가·세금·현지 경쟁 환경을 반영해 가격을 차등 책정하고 있어,
        거주 국가에 따라 실제 부담하는 비용이 이 표 안에서만 <strong>${(prices[prices.length - 1].krw / prices[0].krw).toFixed(1)}배</strong> 차이가 납니다.
      </p>

      <h2 class="${H2}">국가별 요금 순위 — 낮은 순 20개국</h2>
      <div class="sp-table-scroll"><table class="${TABLE}">
        <thead>
          <tr>
            <th class="${TH}">순위</th>
            <th class="${TH}">국가</th>
            <th class="${TH}">월 가격(원화)</th>
            <th class="${TH}">한국 대비</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table></div>
      <p class="sp-note sp-note--tight">요금 조사: ${getSurveyProvenance()} · 환율 기준일: ${data.exchangeRateDate}</p>

`,
    },
    {
      id: "home-why",
      live: false,
      html: `      <h2 class="${H2}">왜 국가별 가격이 다를까요?</h2>
      <p class="${P}">
        유튜브 프리미엄은 국가별로 구매력 평가(PPP), 부가세율, 환율, 경쟁 서비스 가격을 종합해 차등 가격 정책을 운영합니다.
        예를 들어 ${josa(prices[1].country, "은", "는")} 월 ${formatKrw(prices[1].krw)}, ${josa(prices[2].country, "은", "는")} ${formatKrw(prices[2].krw)}로
        한국 가격의 ${formatShareRange(prices[1].krw / krKrw, prices[2].krw / krKrw)} 수준입니다.
        반면 표 안의 ${prices.filter((p) => p.krw > krKrw).length}개국은 한국보다 비쌉니다.
      </p>
      <ul class="${UL}">
        <li class="${LI}"><strong>구매력 평가(PPP)</strong>: 현지 평균 소득에 비례한 가격 책정</li>
        <li class="${LI}"><strong>부가가치세(VAT)</strong>: 국가별 세율이 0~25%로 상이</li>
        <li class="${LI}"><strong>환율 변동</strong>: 달러 강세 시 원화 환산 가격 상승</li>
        <li class="${LI}"><strong>현지 경쟁</strong>: 넷플릭스·스포티파이 등과 경쟁 가격 책정</li>
        <li class="${LI}"><strong>시장 진입 전략</strong>: 신흥 시장 점유율 확보를 위한 저가 정책</li>
      </ul>

      <h2 class="${H2}">서비스 주요 기능</h2>
      <ul class="${UL}">
        <!-- 시점 주장 금지. 정가는 자동 수집 수단이 없어 사람이 조사하므로 "실시간"·"최신"은
             거짓이 된다. 기능은 그대로 두고 근거 날짜(요금 조사일·환율 기준일)에 기댄다. -->
        <li class="${LI}"><strong>${prices.length}개 국가 요금 한눈에 비교</strong> — 각 국가에서 실제로 제공되는 요금제만 전수 조사일(${data.lastUpdated}) 값으로 비교하되, 공식 출처로 다시 확인한 칸은 그 값으로 반영(표의 행마다 표시) (개인 ${planCounts.individual}개국 · 패밀리 ${planCounts.family}개국 · 라이트 ${planCounts.lite}개국 · 듀오 ${planCounts.duo}개국)</li>
        <li class="${LI}"><strong>원화 자동 환산</strong> — 환율 기준일 ${data.exchangeRateDate}의 공개 환율로 원화 비용 확인</li>
        <li class="${LI}"><strong>절약률 계산</strong> — 한국 대비 월·연 절약액 자동 계산</li>
        <li class="${LI}"><strong>국가 간 가격 격차</strong> — 환율이 순위를 얼마나 흔드는지까지 (<a href="/ott/youtube-premium/trends">격차 분석 페이지</a>)</li>
        <li class="${LI}"><strong>이용 가이드</strong> — 국가별 결제·계정 설정 주의사항</li>
        <li class="${LI}"><strong>법적 주의사항 안내</strong> — 약관 위반 위험과 합법 이용 범위</li>
      </ul>

      <h2 class="${H2}">이용 시 주의사항</h2>
      <div class="${CALLOUT}">
        <strong>⚠️ 약관 위반 주의</strong><br>
        Google/YouTube 이용약관상 구독자는 "실제 거주지 국가"의 가격을 지불해야 합니다.
        VPN 또는 가짜 주소를 이용한 국가 우회 구독은 약관 위반이며, 감지 시 구독 취소·환불 거부·계정 정지 조치가 취해질 수 있습니다.
        본 서비스는 단순 가격 정보 제공 목적이며, 약관 위반 행위를 권장하지 않습니다.
      </div>

`,
    },
    {
      id: "home-structure",
      live: false,
      html: buildHomeStructureSection(),
    },
    // 뷰의 ServiceSEOSection FAQ 아코디언과 같은 내용
    {
      id: "home-faq",
      live: true,
      html: `      <h2 class="${H2}">자주 묻는 질문 (FAQ)</h2>
      ${buildFaqSectionHtml(getHomeFaqItems())}

`,
    },
    {
      id: "home-links",
      live: false,
      html: `      <h2 class="${H2}">관련 페이지</h2>
      <ul class="${UL}">
        <li class="${LI}"><a href="/ott/youtube-premium/trends">국가 간 가격 격차와 환율 민감도</a></li>
        <li class="${LI}"><a href="/ott/youtube-premium/${prices[0].countryCode.toLowerCase()}">${prices[0].country} — 이 표의 최저가</a></li>
        <li class="${LI}"><a href="/ott/youtube-premium/kr">한국 가격 상세</a></li>
        <li class="${LI}"><a href="/ott/about">서비스 소개 및 데이터 출처</a></li>
      </ul>

      <p class="sp-note">
        ※ 본 서비스는 Google LLC 또는 YouTube의 공식 제휴 서비스가 아닙니다. 요금 조사: ${getSurveyProvenance()} · 환율 기준일: ${data.exchangeRateDate}.
      </p>`,
    },
  ];
}

function buildTrendsContent() {
  const stats = computeTrendStats();
  const data = stats.data;
  const prices = data.prices
    .filter((p) => p.converted?.individual?.krw)
    .map((p) => ({ ...p, krw: p.converted.individual.krw }))
    .sort((a, b) => a.krw - b.krw);
  const kr = data.prices.find((p) => p.countryCode === "KR");
  const krKrw = kr?.plans?.individual?.monthly ?? kr?.converted?.individual?.krw ?? null;

  const fmtSignedPercent = (value) =>
    value == null ? "-" : `${value > 0 ? "+" : ""}${value}%`;
  const percentClass = (value) => (value < 0 ? "sp-down" : value > 0 ? "sp-up" : "sp-muted");

  // 변동 표는 "서로 다른 시점의 실제 조사"가 2회 이상 있을 때만 의미가 있다.
  // 관측이 1회뿐인데 표를 그리면 환율 차이가 "가격 변동"으로 둔갑한다 —
  // 실제로 이 페이지가 시드 픽스처로 그 상태였다(data/README.md 참고).
  const hasObservedHistory = stats.snapshots.length > 0;

  // 수집 시점별 타임라인 표: 기준국(KR) + 직전 스냅샷 대비 하락/상승 상위 5개국
  const timelineRowsData = [
    ...(stats.baseMover ? [stats.baseMover] : []),
    ...stats.sample,
  ];
  const timelineHeadHtml = stats.timelineDates
    .map((date) => `<th class="${TH}">${date}</th>`)
    .join("");
  const timelineRowsHtml = timelineRowsData
    .map((mover) => {
      const name = stats.nameByCode.get(mover.code) || mover.code;
      const cells = stats.timelineDates
        .map((date) => {
          const krw =
            date === data.lastUpdated
              ? stats.currentByCode.get(mover.code)
              : stats.krwBySnapshotDate.get(date)?.get(mover.code);
          return `<td class="${TD}">${typeof krw === "number" ? formatKrw(krw) : "-"}</td>`;
        })
        .join("");
      return `<tr>
          <td class="${TD}"><a href="/ott/youtube-premium/${mover.code.toLowerCase()}">${name}</a></td>
          ${cells}
          <td class="${TD}"><strong class="${percentClass(mover.changePercent)}">${fmtSignedPercent(mover.changePercent)}</strong></td>
        </tr>`;
    })
    .join("");

  // 가격 데이터 갱신·보정 기록 (data/reports/changelog.json)
  const changelogUpdates = (loadChangelog().updates || [])
    .filter((entry) => !entry.serviceSlug || entry.serviceSlug === "youtube-premium")
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  const changelogRowsHtml = changelogUpdates
    .map((entry) => {
      const code = String(entry.countryCode || "").toUpperCase();
      const name = stats.nameByCode.get(code) || code || "-";
      const date = String(entry.updatedAt || "").slice(0, 10) || "-";
      return `<tr>
          <td class="${TD}">${date}</td>
          <td class="${TD}">${name}</td>
          <td class="${TD}">${typeof entry.previousKrw === "number" ? formatKrw(entry.previousKrw) : "-"}</td>
          <td class="${TD}">${typeof entry.currentKrw === "number" ? formatKrw(entry.currentKrw) : "-"}</td>
          <td class="${TD}">${entry.note || "-"}</td>
        </tr>`;
    })
    .join("");

  // 가격 격차 문장에 쓰는 수치 — 하드코딩 대신 데이터에서 도출
  const expensiveRank = prices.length - prices.findIndex((p) => p.countryCode === "KR");
  const over20kCount = prices.filter((p) => p.krw >= 20000).length;

  return [
    // 뷰가 h1·기준일 헤더·수집 시점별 표·"이 변동을 읽는 법"을 라이브 데이터로 렌더한다
    {
      id: "trends",
      live: true,
      html: `
      <nav aria-label="breadcrumb" class="sp-crumbs">
        <a href="/ott" class="sp-crumb">홈</a> ›
        <a href="/ott/youtube-premium" class="sp-crumb">유튜브 프리미엄</a> ›
        가격 트렌드
      </nav>

      <h1 class="${H1}">유튜브 프리미엄 국가별 가격 격차 (${surveyHeadline(data)})</h1>
${
  hasObservedHistory
    ? `
      <h2 class="${H2}">관측 시점별 원화 환산 가격 (기준국 + 변동 상위)</h2>
      <p class="${P}">
        직전 관측(${stats.lastSnapshot?.date || "-"}) 대비 최신 가격표(${data.lastUpdated}) 기준으로
        환산 가격이 가장 크게 내린 5개국과 가장 크게 오른 5개국, 그리고 기준국인 한국을 함께 보여줍니다.
      </p>
      <div class="sp-table-scroll"><table class="${TABLE}">
        <thead>
          <tr>
            <th class="${TH}">국가</th>
            ${timelineHeadHtml}
            <th class="${TH}">직전 대비</th>
          </tr>
        </thead>
        <tbody>${timelineRowsHtml}</tbody>
      </table></div>
      <p class="sp-note sp-note--tight">
        ※ 원화 환산 기준이라 현지 요금이 그대로여도 환율에 따라 표시값이 달라질 수 있습니다.
      </p>
`
    : ""
}
`,
    },
    // 도입부와 "데이터 범위 안내"는 일부러 live:false다. 이 페이지에서 가장 중요한 문장이
    // "지금은 변동 데이터가 없다"인데, 이걸 live:true 섹션에 두면 하이드레이션 후 제거돼
    // 크롤러만 보고 실제 사용자는 못 보는 상태가 된다. 해명 문구야말로 양쪽에 다 있어야 한다.
    {
      id: "trends-intro",
      live: false,
      html: `      <p class="${P}">
        이 페이지는 유튜브 프리미엄 개인 플랜의 국가별 가격을 <strong>같은 시점 기준으로 나란히</strong> 비교합니다.
        현지 통화 정가는 ${getSurveyProvenance()}이고,
        원화 환산에 쓴 환율은 ${data.exchangeRateDate} 기준입니다. 요금 날짜와 환율 날짜는 성격이 다르므로 따로 표기합니다.
      </p>
      <div class="${INFO}">
        <strong>데이터 범위 안내</strong> — 본 페이지는 실시간·일 단위 가격 시계열을 제공하지 않으며,
        Google/YouTube의 공식 가격 변경 이력 아카이브도 아닙니다.
        ${
          hasObservedHistory
            ? `관측 이력 ${stats.snapshots.length}회(${stats.snapshots.map((s) => s.date).join(", ")})와 최신 가격표(${data.lastUpdated} 기준 ${prices.length}개국)에서 도출할 수 있는 사실만 제공합니다.`
            : `현재 확보된 전수 요금 조사는 <strong>1회분(${data.lastUpdated} 기준 ${prices.length}개국)</strong>${
                D.surveyRounds(data).recheckDate
                  ? `이고 ${D.surveyRounds(data).recheckDate} 공식 출처 재확인은 ${D.surveyRounds(data).recheckedCells}개 값뿐이라`
                  : "뿐이라"
              }, 시점 간 가격 변동은 표시하지 않습니다. 같은 국가를 서로 다른 시점에 두 번 이상 조사해야 변동을 말할 수 있습니다.${
                D.surveyRounds(data).updatedCells > 0
                  ? ` 재확인한 값 가운데 전수 조사 값과 달라 갱신한 ${D.surveyRounds(data).updatedCells}개도, 전수 조사 값에 출처 기록이 없어 관측된 변동으로 내세우지 않습니다.`
                  : ""
              }`
        }
      </div>

`,
    },
    {
      id: "trends-reading",
      live: false,
      html: `      <h2 class="${H2}">이 페이지가 보여주는 것과 보여주지 않는 것</h2>
      <p class="${P}">
        <strong>보여주는 것</strong> — 전수 조사일(${data.lastUpdated})을 기준으로 하고 공식 출처로 다시 확인한 칸만 그 값으로 바꾼
        ${prices.length}개국의 개인 플랜 현지 통화 정가와 그 원화 환산값, 그리고 국가 사이의 가격 격차와 순위입니다.
        재확인한 칸을 빼면 같은 시점끼리의 비교이므로 "어느 나라가 더 싼가"에는 그대로 답할 수 있습니다.
      </p>
      <p class="${P}">
        <strong>보여주지 않는 것</strong> — 특정 국가의 요금이 언제 얼마나 올랐거나 내렸는지입니다.
        시점 간 변동을 말하려면 같은 국가를 서로 다른 날짜에 두 번 이상 조사한 이력이 있어야 하는데,
        ${
          hasObservedHistory
            ? `현재 관측 이력은 ${stats.snapshots.length}회입니다.`
            : `현재 확보된 전수 요금 조사는 1회분뿐입니다. 그래서 변동률 표를 싣지 않습니다.`
        }
      </p>
      <p class="${P}">
        변동을 굳이 만들어 싣지 않는 이유가 있습니다. 원화 환산값만 놓고 두 시점을 빼면
        <strong>환율이 움직인 것을 요금이 움직인 것처럼</strong> 보이게 만들기 때문입니다.
        예를 들어 한국 정가 ${formatKrw(krKrw)}은 애초에 원화로 매겨져 있어 환율과 무관하게 고정인데,
        달러를 거쳐 환산하는 계산을 두 번 돌리면 숫자가 미세하게 흔들립니다.
        그 흔들림에 "가격 변동"이라는 이름을 붙이면 사실이 아닌 정보가 됩니다.
      </p>
      <p class="${P}">
        관측 이력은 다음 요금 조사부터 쌓입니다. 서로 다른 시점의 조사가 2회 이상 모이면
        시점별 비교표와 변동률이 이 자리에 다시 나타납니다. 그때까지는 국가 간 격차만 제공합니다.
      </p>

      <h2 class="${H2}">원화 환산값을 읽을 때 주의할 점</h2>
      <p class="${P}">
        표의 원화 값에는 세 가지가 섞여 있습니다.
        ① <strong>현지 통화 요금</strong>(각국 공표가 그 자체)
        ② <strong>원화 환율</strong>(현지 요금이 같아도 환산값이 변함)
        ③ <strong>두 날짜의 시차</strong>(요금 조사일과 환율 기준일이 다름)입니다.
      </p>
      <p class="${P}">
        이 페이지의 환율 기준일은 ${data.exchangeRateDate}입니다. 환율은 매일 움직이므로
        실제 결제 시점의 청구 금액은 여기 표시된 원화 값과 다를 수 있고,
        카드사 해외 결제 수수료가 추가로 붙습니다. 원화 환산 순위는 참고용으로 보고,
        국가를 고르는 판단은 각 국가 페이지의 <strong>현지 통화 가격</strong>과 함께 확인하는 편이 정확합니다.
      </p>
      <p class="${P}">
        특정 국가의 공식 요금이 실제로 바뀌었는지는 이 페이지만으로 단정하지 말고,
        YouTube 고객센터·Google Play의 공식 안내에서 확인하시기 바랍니다.
      </p>

`,
    },
    {
      id: "trends-fx",
      live: false,
      html: buildTrendsFxSection(),
    },
    {
      id: "trends-continent",
      live: false,
      html: `      <h2 class="${H2}">대륙별 평균 가격</h2>
      <p class="${P}">
        수집된 ${prices.length}개 국가의 대륙별 평균 개인 플랜 가격(원화 환산)입니다.
      </p>
      ${(() => {
        const byContinent = {};
        for (const p of prices) {
          const key = p.continent || "unknown";
          if (!byContinent[key]) byContinent[key] = [];
          byContinent[key].push(p.krw);
        }
        const rows = Object.entries(byContinent)
          .map(([c, arr]) => ({
            continent: getContinentLabel(c),
            avg: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length),
            count: arr.length,
          }))
          .sort((a, b) => a.avg - b.avg);
        return `<div class="sp-table-scroll"><table class="${TABLE}">
          <thead>
            <tr>
              <th class="${TH}">대륙</th>
              <th class="${TH}">평균 가격</th>
              <th class="${TH}">한국 대비</th>
              <th class="${TH}">국가 수</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r) => {
              const diff = ((krKrw - r.avg) / krKrw * 100).toFixed(1);
              const sign = r.avg < krKrw ? "-" : "+";
              return `<tr>
                <td class="${TD}">${r.continent}</td>
                <td class="${TD}">${formatKrw(r.avg)}</td>
                <td class="${TD}"><strong class="${r.avg < krKrw ? 'sp-down' : 'sp-up'}">${sign}${Math.abs(diff)}%</strong></td>
                <td class="${TD}">${r.count}개국</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table></div>`;
      })()}

`,
    },
    // 뷰의 "최저가 TOP 10 (개인)" 카드와 같은 내용
    {
      id: "trends-cheapest",
      live: true,
      html: `      <h2 class="${H2}">저렴한 국가 상위 10위</h2>
      <ol class="${UL}">
        ${prices.slice(0, 10).map((p) => {
          const percent = ((krKrw - p.krw) / krKrw * 100).toFixed(1);
          return `<li class="${LI}"><a href="/ott/youtube-premium/${p.countryCode.toLowerCase()}">${p.country}</a> — ${formatKrw(p.krw)} <span class="sp-down">(-${percent}%)</span></li>`;
        }).join("")}
      </ol>

`,
    },
    {
      id: "trends-spread",
      live: false,
      html: `      <h2 class="${H2}">비싼 국가 상위 5위</h2>
      <ol class="${UL}">
        ${prices.slice(-5).reverse().map((p) => {
          const percent = ((p.krw - krKrw) / krKrw * 100).toFixed(1);
          return `<li class="${LI}"><a href="/ott/youtube-premium/${p.countryCode.toLowerCase()}">${p.country}</a> — ${formatKrw(p.krw)} <span class="sp-up">(+${percent}%)</span></li>`;
        }).join("")}
      </ol>

      <h2 class="${H2}">가격 차이 분석</h2>
      <p class="${P}">
        수집 국가 기준 최저가(${formatKrw(prices[0].krw)}) 대비 최고가(${formatKrw(prices[prices.length - 1].krw)})의 격차는 약 ${((prices[prices.length - 1].krw / prices[0].krw)).toFixed(1)}배에 달합니다.
        이는 Google이 각 국가의 구매력·물가·세율을 종합 반영한 결과이며, 동일 서비스·동일 품질임에도 거주 국가에 따라 비용이 크게 다릅니다.
      </p>
      <p class="${P}">
        참고로 한국은 현재 월 ${formatKrw(krKrw)}로 수집 ${prices.length}개국 중 비싼 순 ${expensiveRank}위입니다.
        미국·영국·북유럽·스위스·호주 등 ${over20kCount}개국은 월 2만원 이상으로 한국보다 높은 편입니다.
      </p>

`,
    },
    // 뷰의 갱신·보정 기록 표와 같은 내용 — 표는 뷰가 라이브로 다시 그린다.
    //
    // FAQ를 이 섹션에서 떼어낸 이유: 예전에는 표와 FAQ가 한 덩어리로 live:true였다.
    // 그래서 하이드레이션 때 프리렌더 FAQ가 통째로 지워졌는데, 화면에 남은 대응물은
    // 아코디언이었고 radix 아코디언은 접힌 패널을 DOM에서 아예 언마운트한다.
    // 결과: FAQPage 스키마는 4문항을 신고하는데 답변 4개가 innerHTML 기준으로 부재.
    // (card #53이 같은 결함을 "화면이 이미 커버함" 분류를 걷어내 해소했다.)
    {
      id: "trends-log",
      live: true,
      html: `${
        changelogUpdates.length > 0
          ? `      <h2 class="${H2}">가격 데이터 갱신·보정 기록</h2>
      <p class="${P}">
        수집 데이터를 재확인·보정한 기록입니다. 환율 반영이나 수치 검수 내역이 포함되며,
        Google/YouTube의 공식 요금 개편 공지와는 다를 수 있습니다.
      </p>
      <div class="sp-table-scroll"><table class="${TABLE}">
        <thead>
          <tr>
            <th class="${TH}">일자</th>
            <th class="${TH}">국가</th>
            <th class="${TH}">이전</th>
            <th class="${TH}">현재</th>
            <th class="${TH}">메모</th>
          </tr>
        </thead>
        <tbody>${changelogRowsHtml}</tbody>
      </table></div>

`
          : ""
      }`,
    },
    // live:false — 뷰가 <SeoRichContent>로 이 문구를 그대로 다시 렌더한다.
    // 화면 FAQ = 프리렌더 FAQ = FAQPage 스키마가 한 소스에서 나오므로,
    // 스키마가 DOM에 없는 답변을 신고하는 상태가 구조적으로 불가능해진다.
    {
      id: "trends-faq",
      live: false,
      html: `      <h2 class="${H2}">자주 묻는 질문 (FAQ)</h2>
      ${buildFaqSectionHtml(getTrendsFaqItems())}

`,
    },
    {
      id: "trends-links",
      live: false,
      html: `      <h2 class="${H2}">관련 링크</h2>
      <ul class="${UL}">
        <li class="${LI}"><a href="/ott/youtube-premium">전체 국가 가격 비교</a></li>
        <li class="${LI}"><a href="/ott/youtube-premium/kr">한국 가격 상세</a></li>
        <li class="${LI}"><a href="/ott/about">서비스 소개 및 데이터 출처</a></li>
      </ul>

      <p class="sp-note">
        ※ 현지 통화 요금은 ${getSurveyProvenance()}이고, 원화 환산에 쓴 환율은 ${data.exchangeRateDate} 기준입니다.
        실시간·일 단위 시계열은 제공하지 않으며, 실제 결제 금액은 Google Play·YouTube 공식 페이지에서 최종 확인해야 합니다.
      </p>`,
    },
  ];
}

function buildAboutContent() {
  // 날짜는 가격 시드에서만 읽는다. /about이 자기 문장에 날짜를 하드코딩하면
  // 이 페이지 혼자 옛 날짜를 들고 남는다 — 지금 고치고 있는 결함이 바로 그 종류다.
  const data = loadData();
  return [{ id: "about", live: false, html: `
      <h1 class="${H1}">서비스 소개 — OTT Watcher</h1>

      <p class="${P}">
        <strong>OTT Watcher</strong>는 유튜브 프리미엄(YouTube Premium) 등 글로벌 OTT 서비스의
        국가별 구독료를 원화로 환산해 비교 제공하는 무료 서비스입니다.
        회원가입 없이 누구나 이용할 수 있으며, 44개국의 플랜별 상세 가격과 한국 대비 절약률을 한눈에 확인할 수 있습니다.
      </p>

      <p class="${P}">
        본 서비스는 Google/YouTube의 공식 제휴 서비스가 아닌 독립 프로젝트로,
        소비자의 알 권리 보장과 정보 투명성 향상을 목표로 운영됩니다.
        유튜브 프리미엄 이용자가 자신이 지불하는 구독료가 다른 국가와 얼마나 차이나는지 확인할 수 있도록 하고,
        전 세계 가격 정책의 투명성을 높이는 것을 미션으로 합니다.
      </p>

      <h2 class="${H2}">1. 서비스 탄생 배경</h2>
      <p class="${P}">
        대한민국 유튜브 프리미엄 가격은 2018년 출시 이후 지속적으로 인상되어 왔습니다.
        초기 8,690원에서 현재 14,900원으로 약 71% 인상되었으며, 사용자들의 불만이 커지고 있습니다.
        같은 서비스를 이용하는데 인도·튀르키예·아르헨티나 등에서는 2,000~3,000원대로 이용할 수 있다는 사실이 알려지며,
        "왜 한국만 이렇게 비싼가?"라는 소비자의 의문이 제기되었습니다.
      </p>
      <p class="${P}">
        본 서비스는 이러한 소비자 궁금증에 답하기 위해 탄생했습니다.
        단순 가격 비교를 넘어 각 국가의 구매력·세율·경쟁 환경까지 함께 설명해 "왜 이 가격인지" 이해할 수 있도록 돕습니다.
      </p>

      <h2 class="${H2}">2. 제공 정보</h2>
      <ul class="${UL}">
        <li class="${LI}"><strong>44개국 유튜브 프리미엄 가격</strong> — 개인·가족·학생·Duo·Lite 플랜</li>
        <li class="${LI}"><strong>원화 환산</strong> — 공개 환율 API에서 가져온 기준일 환율로 USD/KRW 환산</li>
        <li class="${LI}"><strong>한국 대비 절약률</strong> — 월·연 단위 절약 가능 금액 계산</li>
        <li class="${LI}"><strong>가격 트렌드 분석</strong> — 대륙별·국가별 평균 가격 분포</li>
        <li class="${LI}"><strong>이용 가이드</strong> — 국가별 결제·계정 설정 주의사항</li>
        <li class="${LI}"><strong>법적 주의사항</strong> — 약관 위반 리스크와 합법 이용 범위 명시</li>
      </ul>

      <h2 class="${H2}">3. 데이터 출처 및 검증 방법</h2>
      <p class="${P}">
        가격 데이터는 사람이 조사해 반영합니다.
        자동 수집 수단이 없으므로 상시 최신을 보장하지 않으며, 정해진 갱신 주기도 두고 있지 않습니다.
        대신 실제로 조사한 날짜를 표기합니다 — 현재 요금 조사는 ${getSurveyProvenance()}입니다.
        ${surveyScopeSentence(data)}
        재확인한 값은 <a href="https://www.youtube.com/premium" target="_blank" rel="noopener noreferrer">YouTube Premium 공식 페이지</a>·Google 공식 페이지와
        직접 대조해 출처를 기록했고, 국가별 가격표의 각 행에 재확인 여부를 표시합니다.
        요금제·결제 관련 공식 안내는 <a href="https://support.google.com/youtube" target="_blank" rel="noopener noreferrer">YouTube 고객센터</a>에서 확인할 수 있습니다.
      </p>
      <p class="${P}">
        원화 환산에 쓰는 환율은 공개 환율 API(open.er-api.com)에서 받아온 스냅샷이며,
        기준일은 ${data.exchangeRateDate}입니다. 요금 조사일과 환율 기준일은 성격이 다른 날짜라
        각 페이지에 따로 표기하며, 화면에 보이는 원화 값은 프리렌더·하이드레이션 모두
        이 스냅샷 한 벌에서 계산합니다. 실시간 시세나 일 단위 가격 시계열은 제공하지 않습니다.
      </p>

      <h2 class="${H2}">4. 이용 시 주의사항</h2>
      <div class="${CALLOUT}">
        <strong>⚠️ 약관 위반 위험 안내</strong><br>
        Google/YouTube 이용약관에 따르면, 구독자는 "실제 거주지 국가"의 가격을 지불해야 합니다.
        VPN·가짜 주소·타국 결제 수단을 이용한 우회 구독은 약관 위반이며, 감지 시 다음 조치가 취해질 수 있습니다:
        <ul class="sp-ul-nested">
          <li>구독 자동 취소</li>
          <li>기존 결제 환불 거부</li>
          <li>Google 계정 경고 또는 일시 정지</li>
          <li>향후 청구 국가 자동 재변경</li>
        </ul>
      </div>
      <p class="${P}">
        본 서비스는 가격 정보 제공 목적이며, 약관 위반 행위를 권장하지 않습니다.
        실제로 해외 거주·체류 중인 사용자만 해당 국가의 가격으로 합법적으로 구독할 수 있습니다.
      </p>

      <h2 class="${H2}">5. 운영자 정보</h2>
      <p class="${P}">
        운영: ShakiLabs · 문의: <a href="mailto:skdba1313@gmail.com">skdba1313@gmail.com</a>
      </p>
      <div class="sp-table-scroll"><table class="${TABLE}">
        <tbody>
          <tr>
            <td class="${TD}">운영</td>
            <td class="${TD}">ShakiLabs</td>
          </tr>
          <tr>
            <td class="${TD}">서비스 URL</td>
            <td class="${TD}">https://shakilabs.com/ott</td>
          </tr>
          <tr>
            <td class="${TD}">이메일 문의</td>
            <td class="${TD}"><a href="mailto:skdba1313@gmail.com">skdba1313@gmail.com</a></td>
          </tr>
          <tr>
            <td class="${TD}">응답 시간</td>
            <td class="${TD}">영업일 24~48시간 이내</td>
          </tr>
          <tr>
            <td class="${TD}">법적 고지</td>
            <td class="${TD}"><a href="/ott/privacy">개인정보처리방침</a> · <a href="/ott/terms">이용약관</a></td>
          </tr>
        </tbody>
      </table></div>

      <h2 class="${H2}">6. 수익 구조</h2>
      <p class="${P}">
        본 서비스는 광고(Google AdSense)를 통해 운영비를 충당하며, 사용자에게 이용료를 받지 않습니다.
        광고 수익은 서버·환율 API·데이터 수집 비용에 사용되며, 사용자 개인정보를 판매하지 않습니다.
      </p>

      <h2 class="${H2}">7. 면책 조항</h2>
      <p class="${P}">
        본 서비스에서 제공하는 모든 가격 정보는 참고용이며, 법적 효력이 없습니다.
        실제 결제 가격은 Google Play·YouTube 공식 페이지에서 최종 확인해야 하며,
        환율·세금·할인 이벤트에 따라 본 페이지의 표시 가격과 차이가 있을 수 있습니다.
        본 서비스 이용으로 인한 직접·간접 손실에 대해 책임을 지지 않습니다.
      </p>

      <p class="sp-note">
        요금 조사: ${getSurveyProvenance()} · 환율 기준일: ${loadData().exchangeRateDate}
      </p>` }];
}

function buildPrivacyContent() {
  return [{ id: "privacy", live: false, html: `
      <h1 class="${H1}">개인정보 처리방침</h1>

      <p class="${P}">
        OTT Watcher(이하 "서비스")는 이용자의 개인정보를 소중히 여기며, 관련 법령을 준수합니다.
        본 방침은 서비스 이용 과정에서 수집·이용되는 정보를 안내합니다.
      </p>

      <h2 class="${H2}">1. 수집하는 정보</h2>
      <p class="${P}">
        본 서비스는 별도의 회원가입이 없으며, 직접적인 개인정보를 수집하지 않습니다.
        다만 서비스 운영 과정에서 다음 정보가 자동 수집될 수 있습니다.
      </p>
      <ul class="${UL}">
        <li class="${LI}"><strong>자동 수집</strong>: 접속 IP, 브라우저 종류, 접속 시간, 방문 페이지</li>
        <li class="${LI}"><strong>쿠키</strong>: 선호 국가 저장, Google Analytics 측정 쿠키, Google AdSense 광고 쿠키</li>
        <li class="${LI}"><strong>익명 게시물 작성 시</strong>: 작성 내용, 자동 생성 닉네임, 작성 시점의 IP와 User-Agent</li>
      </ul>
      <p class="${P}">
        익명 게시물에 부수적으로 기록되는 IP와 User-Agent는 어뷰징·스팸 대응 목적으로만 사용하며,
        외부에 공개하거나 제3자에게 제공하지 않습니다.
      </p>
      <p class="${P}">
        본 서비스는 회원가입·뉴스레터·가격 알림 등 이메일 주소를 수집하는 기능을 운영하지 않으며,
        이용자가 문의 목적으로 직접 발송한 이메일 외에 이메일 주소를 수집·보관하지 않습니다.
        테마 등 화면 설정 값은 이용자의 브라우저(localStorage)에만 저장되며 서버로 전송되지 않습니다.
      </p>

      <h2 class="${H2}">2. 이용 목적</h2>
      <ul class="${UL}">
        <li class="${LI}">서비스 통계 및 개선</li>
        <li class="${LI}">악의적 이용 방지</li>
        <li class="${LI}">맞춤형 광고 제공 (Google AdSense)</li>
      </ul>

      <h2 class="${H2}">3. 제3자 서비스</h2>
      <ul class="${UL}">
        <li class="${LI}"><strong>Google Analytics 4</strong> — 익명 방문 통계</li>
        <li class="${LI}"><strong>Google AdSense</strong> — Google을 포함한 제3자 광고 사업자는 광고 쿠키를 사용하여
          이용자의 본 사이트 및 다른 웹사이트 방문 기록을 기반으로 맞춤 광고를 게재할 수 있습니다.</li>
      </ul>

      <h2 class="${H2}">4. 쿠키 관리</h2>
      <p class="${P}">
        브라우저 설정에서 쿠키 저장을 거부할 수 있으나 일부 기능이 제한될 수 있습니다.
        Google Analytics 수집 거부는 <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">Google Analytics Opt-out Add-on</a>을 이용하세요.
        맞춤 광고(개인 맞춤 광고)는 <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">Google 광고 설정</a>
        또는 <a href="https://www.aboutads.info/choices" target="_blank" rel="noopener noreferrer">www.aboutads.info/choices</a>에서
        언제든지 사용 중지(opt-out)할 수 있습니다.
      </p>

      <h2 class="${H2}">5. 보관 및 파기</h2>
      <p class="${P}">
        방문 로그는 Google Analytics 정책에 따라 기본 26개월 보관됩니다.
        서버 액세스 로그는 보안·통계 목적으로 최대 6개월 보관 후 자동 파기됩니다.
        익명 커뮤니티 글·댓글에 부수적으로 기록되는 IP와 User-Agent는 어뷰징·스팸 대응 목적으로만 사용하며,
        해당 글이 삭제되면 함께 삭제됩니다.
      </p>

      <h2 class="${H2}">6. 국외 이전</h2>
      <p class="${P}">
        본 서비스는 Google Analytics와 Google AdSense를 이용하므로, 위 항목의 자동 수집 정보가
        Google LLC가 운영하는 국외 서버에서 처리될 수 있습니다.
        이전되는 항목은 접속 기록·쿠키 식별자 등 비식별 이용 정보이며, 이전 목적은 통계 분석과 광고 게재입니다.
        이용자는 쿠키 차단 또는 아래 4항의 opt-out 수단으로 해당 처리를 거부할 수 있습니다.
      </p>

      <h2 class="${H2}">7. 만 14세 미만 아동</h2>
      <p class="${P}">
        본 서비스는 만 14세 미만 아동을 대상으로 하지 않으며, 아동의 개인정보를 알면서 수집하지 않습니다.
        아동의 정보가 수집된 사실을 확인한 경우 지체 없이 파기합니다.
      </p>

      <h2 class="${H2}">8. 안전성 확보 조치</h2>
      <ul class="${UL}">
        <li class="${LI}">전 구간 HTTPS 암호화 전송</li>
        <li class="${LI}">계산·설정 값의 브라우저 내 처리(서버 미전송)로 수집 자체를 최소화</li>
        <li class="${LI}">관리자 접근 권한 최소화 및 접근 기록 보관</li>
      </ul>

      <h2 class="${H2}">9. 이용자 권리</h2>
      <p class="${P}">
        이용자는 언제든 본인 관련 정보의 열람·정정·삭제·처리정지를 요청할 수 있으며,
        문의는 아래 이메일로 가능합니다. 합리적인 기간 내에 처리해 드립니다.
        개인정보 침해에 관한 상담이 필요하면 개인정보침해신고센터(privacy.kisa.or.kr, 국번 없이 118),
        개인정보 분쟁조정위원회(kopico.go.kr)에 문의할 수 있습니다.
      </p>

      <h2 class="${H2}">10. 개인정보 보호책임자 및 문의</h2>
      <ul class="${UL}">
        <li class="${LI}">운영: ShakiLabs</li>
        <li class="${LI}">개인정보 보호 책임: 운영자 (ShakiLabs)</li>
        <li class="${LI}">이메일: <a href="mailto:skdba1313@gmail.com">skdba1313@gmail.com</a></li>
        <li class="${LI}">접수 후 처리 기간: 영업일 기준 24~48시간 이내 회신</li>
      </ul>
      <p class="${P}">
        열람·정정·삭제·처리정지 요청은 위 이메일로 접수하며, 본인 확인이 필요한 경우
        추가 자료를 요청할 수 있습니다. 요청 처리 결과는 같은 경로로 안내합니다.
      </p>

      <h2 class="${H2}">11. 방침의 변경</h2>
      <p class="${P}">
        본 방침은 관련 법령·서비스 정책·이용하는 제3자 서비스의 변경에 따라 개정될 수 있습니다.
        내용이 바뀌면 개정 사항과 시행일을 본 페이지에 공지하며, 이용자에게 불리한 변경은
        시행일 전에 충분한 기간을 두고 안내합니다.
      </p>

      <p class="sp-note">
        본 방침은 관련 법령 및 서비스 정책 변경 시 개정될 수 있으며, 변경 시 본 페이지에 공지합니다.
      </p>` }];
}

function buildTermsContent() {
  return [{ id: "terms", live: false, html: `
      <h1 class="${H1}">이용약관</h1>

      <p class="${P}">
        본 약관은 OTT Watcher(이하 "서비스")의 이용 조건과 책임 범위를 규정합니다.
        서비스를 이용함으로써 본 약관에 동의한 것으로 간주됩니다.
      </p>

      <h2 class="${H2}">1. 서비스 개요</h2>
      <p class="${P}">
        OTT Watcher는 유튜브 프리미엄 등 글로벌 OTT 서비스의 국가별 가격 정보를 수집·비교 제공하는 무료 서비스입니다.
        본 서비스는 Google LLC 또는 YouTube의 공식 제휴 서비스가 아닙니다.
      </p>
      <ul class="${UL}">
        <li class="${LI}">서비스는 각 OTT 사업자가 공개한 정가를 정보 제공 목적으로 수집·정리해 보여줍니다.</li>
        <li class="${LI}">모든 가격은 참고 자료이며, 특정 결제 수단이나 구독 경로를 권장하지 않습니다.</li>
        <li class="${LI}">회원가입 없이 누구나 무료로 이용할 수 있고, 이용료를 청구하지 않습니다.</li>
      </ul>

      <h2 class="${H2}">2. 데이터 정확성</h2>
      <p class="${P}">
        서비스는 공개된 정보를 기반으로 최대한 정확한 데이터를 제공하기 위해 노력합니다.
        그러나 가격·환율·정책은 실시간으로 변동되며, 본 서비스의 데이터와 실제 결제 금액 간에 차이가 있을 수 있습니다.
        최종 가격은 Google Play·YouTube 공식 페이지에서 확인해야 합니다.
      </p>
      <p class="${P}">
        특히 원화 환산가는 <strong>기준일 환율에 따른 추정치</strong>입니다.
        실제 청구액은 결제 시점의 환율, 카드사 해외 결제 수수료(통상 결제액의 1% 내외),
        해외 원화 결제(DCC) 여부, 국가별 부가가치세 포함 여부에 따라 달라질 수 있습니다.
        따라서 본 서비스의 숫자는 국가 간 비교용 기준값으로 보고, 결제 직전에는 반드시
        사업자 공식 페이지의 표시가를 확인하시기 바랍니다.
      </p>

      <h2 class="${H2}">3. 이용자 책임</h2>
      <p class="${P}">
        본 서비스의 가격 정보를 근거로 VPN·가짜 주소 등을 이용해 타국 가격으로 구독하는 행위는
        Google/YouTube 이용약관 위반이 될 수 있으며, 구독 취소·환불 거부·계정 정지 등의 불이익을 받을 수 있습니다.
        이로 인한 모든 책임은 이용자 본인에게 있으며, 본 서비스는 이를 권장하지 않습니다.
      </p>

      <h2 class="${H2}">4. 면책 조항</h2>
      <p class="${P}">
        본 서비스는 정보 제공을 목적으로 하며, 서비스 이용으로 인해 발생한 직접·간접 손실에 대해 책임을 지지 않습니다.
        서비스는 사전 고지 없이 변경·중단될 수 있으며, 이로 인한 손실은 이용자가 감수합니다.
      </p>

      <h2 class="${H2}">5. 광고</h2>
      <p class="${P}">
        본 서비스는 Google AdSense를 통해 광고를 게재합니다. Google을 포함한 제3자 광고 사업자는 광고 쿠키를 사용하여
        이용자의 방문 기록 기반 맞춤 광고를 게재할 수 있으며, 맞춤 광고는
        <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">Google 광고 설정</a>
        또는 <a href="https://www.aboutads.info/choices" target="_blank" rel="noopener noreferrer">www.aboutads.info/choices</a>에서
        거부할 수 있습니다. 광고 클릭으로 발생하는 거래·계약은 광고주와 이용자 간에 이루어지며,
        본 서비스는 이에 관여하지 않습니다.
      </p>

      <h2 class="${H2}">6. 서비스 제공 시간과 변경</h2>
      <p class="${P}">
        서비스는 연중무휴 제공을 원칙으로 하나, 데이터 갱신·설비 점검·장애 복구가 필요한 경우 일시 중단될 수 있습니다.
        긴급한 사유가 아니라면 중단 사실과 사유를 사전에 공지하며, 가격 데이터의 갱신 주기는
        사업자 공지 확인 시점에 따라 달라질 수 있습니다.
      </p>

      <h2 class="${H2}">7. 금지 행위</h2>
      <ul class="${UL}">
        <li class="${LI}">자동화 도구로 과도한 요청을 발생시켜 서비스 운영을 방해하거나 시스템에 과부하를 주는 행위</li>
        <li class="${LI}">가공된 가격 데이터를 무단으로 크롤링·대량 수집·복제해 재배포하는 행위</li>
        <li class="${LI}">타인의 권리를 침해하거나 약관 우회 방법을 안내하는 게시물을 등록하는 행위</li>
        <li class="${LI}">불법적인 내용, 광고·스팸, 타인을 사칭하는 게시물을 등록하는 행위</li>
      </ul>
      <p class="${P}">
        위 행위가 확인되면 사전 통지 없이 접근을 제한하거나 해당 게시물을 삭제할 수 있습니다.
        이용자는 각 OTT 사업자의 이용약관과 대한민국 관련 법령을 함께 준수해야 하며,
        본 서비스는 이용자의 약관 위반 행위에 대해 책임지지 않습니다.
      </p>

      <h2 class="${H2}">8. 외부 링크</h2>
      <p class="${P}">
        본 서비스는 사업자 공식 페이지 등 외부 사이트로 연결되는 링크를 포함합니다.
        연결된 사이트의 콘텐츠와 정책은 해당 사이트 운영자의 책임이며, 본 서비스는 이에 대해 보증하지 않습니다.
      </p>

      <h2 class="${H2}">9. 저작권 및 지식재산권</h2>
      <p class="${P}">
        본 서비스의 디자인·코드·가공된 가격 데이터의 저작권은 Shakilabs에 있으며, 무단 복제·배포를 금지합니다.
        유튜브 관련 상표는 Google LLC의 소유입니다.
      </p>
      <ul class="${UL}">
        <li class="${LI}">화면 디자인·로고·소프트웨어 등 일체의 지식재산권은 운영자에게 귀속됩니다.</li>
        <li class="${LI}">각 OTT 서비스명과 상표는 해당 회사의 등록 상표이며, 본 서비스는 해당 기업과 제휴 관계가 없습니다.</li>
        <li class="${LI}">원본 가격 정보의 권리는 각 서비스 제공자에게 있고, 본 서비스는 이를 수집·가공한 결과물만 제공합니다.</li>
      </ul>

      <h2 class="${H2}">10. 준거법 및 분쟁 해결</h2>
      <p class="${P}">
        본 약관은 대한민국 법령에 따라 해석됩니다. 서비스 이용과 관련해 분쟁이 발생한 경우
        운영자와 이용자는 먼저 협의를 통한 해결을 시도하며, 협의가 이루어지지 않으면
        민사소송법상 관할 법원에 소를 제기할 수 있습니다.
      </p>

      <h2 class="${H2}">11. 개정</h2>
      <p class="${P}">
        본 약관은 필요에 따라 개정될 수 있으며, 개정 시 본 페이지에 공지합니다.
        개정 후에도 서비스를 계속 이용할 경우 개정 약관에 동의한 것으로 간주됩니다.
      </p>

      <p class="sp-note">
        문의: <a href="mailto:skdba1313@gmail.com">skdba1313@gmail.com</a>
      </p>` }];
}

function buildCommunityContent() {
  return [{ id: "community", live: false, html: `
      <h1 class="${H1}">OTT 구독료 커뮤니티</h1>

      <p class="${P}">
        커뮤니티 게시판은 현재 운영하지 않습니다.
        유튜브 프리미엄 국가별 요금과 가격 격차는 아래 관련 페이지에서 확인할 수 있습니다.
      </p>

      <h2 class="${H2}">주의사항</h2>
      <p class="${P}">
        VPN·가짜 주소를 이용한 약관 위반 우회 방법 공유는 금지됩니다.
        Google/YouTube 이용약관을 준수하는 합법적인 이용 팁만 공유해주세요.
      </p>

      <h2 class="${H2}">관련 페이지</h2>
      <ul class="${UL}">
        <li class="${LI}"><a href="/ott/youtube-premium">전체 국가 가격 비교</a></li>
        <li class="${LI}"><a href="/ott/youtube-premium/trends">가격 트렌드 분석</a></li>
        <li class="${LI}"><a href="/ott/about">서비스 소개</a></li>
      </ul>

      <p class="${P}">
        문의: <a href="mailto:skdba1313@gmail.com">skdba1313@gmail.com</a>
      </p>` }];
}

// =========================
// 메인 엔트리
// =========================

/**
 * 라우트별 콘텐츠 섹션 목록.
 *
 * 각 섹션은 `{ id, live, html }`이다.
 * - `live: false` — 이 문구는 오직 여기에만 있다. **뷰가 반드시 렌더해야 한다.**
 * - `live: true`  — 뷰가 같은 내용을 API 데이터로 이미 라이브 렌더한다(정렬·필터 가능한
 *   실제 표). 정적 HTML에는 크롤러·JS 끔 환경을 위해 스냅샷 형태로 싣지만,
 *   뷰에서 또 렌더하면 같은 표가 두 번 나오므로 건너뛴다.
 *
 * 이 구분이 "JS 끔 자수 ≈ JS 켬 자수"를 구조적으로 보장한다.
 */
export function buildSections(route) {
  if (route === "/") {
    return buildLandingContent();
  }

  if (route === "/youtube-premium") {
    return buildHomeContent();
  }

  if (route === "/youtube-premium/trends") {
    return buildTrendsContent();
  }

  if (route === "/about") {
    return buildAboutContent();
  }

  if (route === "/privacy") {
    return buildPrivacyContent();
  }

  if (route === "/terms") {
    return buildTermsContent();
  }

  if (route === "/community") {
    return buildCommunityContent();
  }

  // /youtube-premium/:code
  if (route.startsWith("/youtube-premium/")) {
    const code = route.split("/").at(-1);
    if (code && /^[a-z]{2}$/.test(code)) {
      return buildCountryContent(code);
    }
  }

  return [];
}

/** 뷰가 렌더해야 하는 섹션만 — 라이브 대응물이 있는 섹션은 제외한다. */
export function buildViewSections(route) {
  return buildSections(route).filter((section) => !section.live);
}

/** 프리렌더용 정적 HTML — 모든 섹션을 하나의 <article>로 감싼다. */
export function buildRichContent(route) {
  const sections = buildSections(route);
  if (sections.length === 0) return null;
  const articleId = sections[0].id;
  const body = sections.map((section) => section.html).join("\n");
  return `
    <article data-seo-prerender="${articleId}" class="${ARTICLE} ${PRERENDER_FRAME}">${body}
    </article>`;
}

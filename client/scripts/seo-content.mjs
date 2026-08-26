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

let _data = null;
let _history = null;
let _changelog = null;
let _services = null;

/**
 * 데이터 주입 — Node는 fs로 읽은 JSON을, 브라우저는 Vite가 번들한 JSON을 넘긴다.
 * 두 소비자 모두 모듈 로드 직후 1회만 호출한다.
 */
export function configureSeoContent({ priceSeed, history, changelog, services }) {
  _data = priceSeed;
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
  const krKrw = kr?.converted?.individual?.krw ?? null;
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

  return [
    {
      q: "한국에서 가장 저렴하게 구독하는 방법은 무엇인가요?",
      a: `한국 계정에서 고를 수 있는 요금제는 <strong>개인 플랜(월 ${fmtWon(krIndividual)})</strong>과 <strong>Premium Lite(월 ${fmtWon(krLite)})</strong> 두 가지입니다. 광고 제거·백그라운드 재생만 필요하고 YouTube Music이 필요 없다면 Lite가 월 ${krLiteGap != null ? fmtWon(krLiteGap) : "-"} 저렴합니다. <strong>대한민국은 가족 요금제와 학생 할인 플랜이 모두 제공되지 않는 국가</strong>입니다(${FAMILY_PLAN_UNAVAILABLE_NOTE}). 따라서 여러 명이 나눠 내 1인당 요금을 낮추는 방식은 한국 계정에서는 선택지가 아니며, 이 페이지의 국가별 표에서 한국 행에 가족·학생 요금이 비어 있는 것도 같은 이유입니다.`,
    },
    {
      q: "데이터는 얼마나 자주 업데이트되나요?",
      // 두 날짜는 성격이 다르다. 요금 조사는 자동 수집 수단이 없어 사람이 하고,
      // 환율만 API로 자동 갱신된다. 하나로 뭉뚱그리면 "요금도 매일 갱신된다"로 읽힌다.
      a: `가격 기준일과 환율 기준일은 서로 다르며 따로 표기합니다. <strong>요금 조사일: ${data.lastUpdated}</strong> — 현지 통화 정가는 Google의 가격 정책 변경 공지를 사람이 확인한 뒤 반영하므로, 이 날짜는 실제로 요금을 조사한 날짜입니다. <strong>환율 기준일: ${data.exchangeRateDate}</strong> — 원화 환산에 쓰는 환율은 공개 환율 API에서 자동으로 가져옵니다. 미리 렌더된 페이지의 원화 값은 배포 시점 환율로 계산돼 있어, 지금 보고 계신 시점의 환율과는 차이가 날 수 있습니다.`,
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
      a: `Lite 플랜은 일부 국가에서만 제공되는 저가 요금제로, YouTube Music이 제외된 "광고 제거 전용" 플랜입니다. 가격은 일반 개인 플랜의 약 50~60% 수준이며, 한국에서도 월 8,500원에 이용할 수 있습니다.`,
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
      a: `현재는 유튜브 프리미엄 ${stats.countryCount}개국 데이터가 공개되어 있습니다. 넷플릭스 등 다른 OTT는 국가별 요금제 구성이 서로 달라 같은 기준으로 정렬할 수 있을 때 순차적으로 추가합니다. 비교 대상이 아닌 서비스는 목록에 "준비 중"으로 표시합니다.`,
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
  const lastUpdated = data.lastUpdated || "";
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
      a: `국가별 가격은 환율·물가·부가세 변동에 따라 조정되며, Google이 주기적으로 가격 정책을 재검토합니다. 본 페이지의 가격은 ${lastUpdated} 기준이며, 실제 결제 시점에 따라 다를 수 있으므로 Google Play·YouTube 공식 페이지에서 최종 확인하세요.`,
    },
  ];
}

// 트렌드 페이지 FAQ — 런타임 TrendsView.vue의 faqItems와 동일 문구를 유지한다
function getTrendsFaqItems() {
  const data = loadData();
  const fxDate = data.exchangeRateDate || data.lastUpdated || "-";
  const surveyDate = data.lastUpdated || "-";

  return [
    {
      q: "이 페이지에서 가격 변동 추이를 볼 수 있나요?",
      a: `아직 볼 수 없습니다. 변동을 보여주려면 같은 국가를 서로 다른 시점에 두 번 이상 조사한 이력이 있어야 하는데, 현재는 요금 조사 1회분(${surveyDate} 기준)만 확보돼 있습니다. 그래서 이 페이지는 시점 간 변동 대신 같은 시점의 국가 간 가격 격차를 보여줍니다. 두 번째 조사가 쌓이면 시점별 비교표가 이 자리에 나타납니다.`,
    },
    {
      q: "가격 데이터는 어떻게, 얼마나 자주 수집되나요?",
      a: `현지 통화 정가는 자동 수집 수단이 없어 사람이 공식 요금 안내를 확인해 반영합니다. 현재 요금 조사일은 ${surveyDate}입니다. 원화 환산에 쓰는 환율만 공개 환율 API에서 자동으로 가져오며 기준일은 ${fxDate}입니다. 실시간·일 단위 가격 시계열은 제공하지 않습니다.`,
    },
    {
      q: "과거 특정 시점의 공식 요금도 확인할 수 있나요?",
      a: "아니요. 본 페이지는 Google/YouTube의 공식 가격 변경 이력 아카이브가 아니며, 과거 요금 이력을 보관하고 있지 않습니다. 특정 시점의 공식 요금이나 인상 공지는 YouTube 고객센터 등 공식 채널에서 확인해야 정확합니다.",
    },
    {
      q: "환율이 바뀌면 순위도 바뀌나요?",
      a: "네. 원화 환산 최저가 순위는 환율에 따라 달라질 수 있습니다. 현지 요금이 그대로여도 해당 통화가 원화 대비 강세면 환산 가격이 올라 순위가 밀리고, 약세면 내려갑니다. 순위와 함께 현지 통화 가격을 같이 확인하는 것이 안전합니다.",
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
  const krKrw = kr?.converted?.individual?.krw || 14897;
  const countryKrw = row.converted?.individual?.krw ?? null;
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

  const lastUpdated = data.lastUpdated || "";
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

      <h1 class="${H1}">유튜브 프리미엄 ${countryName} 가격 (요금 조사 ${lastUpdated} 기준)</h1>

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
        요금 조사일: ${lastUpdated} · 환율 기준일: ${data.exchangeRateDate}
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
        ※ 본 페이지의 현지 통화 요금은 공개된 출처를 기반으로 ${lastUpdated}에 조사한 자료이고, 원화 환산에 쓴 환율은 ${data.exchangeRateDate} 기준입니다. 실제 Google Play/YouTube 공식 가격과 다를 수 있습니다.
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
function buildLandingContent() {
  const stats = computeCatalogStats();
  const data = stats.data;
  const services = loadServices().services || [];
  const rate = Number(data.krwRate);

  const serviceRowsHtml = services
    .map((service) => {
      const isActive = Boolean(service.active);
      const planNames = (service.plans || []).map((plan) => plan.name).join(" · ");
      const nameCell = isActive
        ? `<a href="/ott/${service.slug}">${service.name}</a>`
        : service.name;
      const coverage = isActive ? `${stats.countryCount}개국` : "-";
      const status = isActive
        ? '<strong class="sp-down">비교 가능</strong>'
        : '<span class="sp-muted">준비 중</span>';
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

      <p class="${P}">
        같은 OTT 서비스라도 어느 나라 계정으로 결제하느냐에 따라 청구되는 금액이 크게 달라집니다.
        이곳은 그 차이를 <strong>같은 기준으로 환산해</strong> 확인할 수 있도록 만든 비교 서비스의 시작 페이지입니다.
        어떤 서비스를 비교할 수 있는지, 가격을 어떤 방식으로 환산하는지, 어느 페이지부터 보면 되는지를 안내합니다.
      </p>

      <p class="${P}">
        나라별 요금표 자체가 필요하다면 곧바로 <a href="/ott/youtube-premium">유튜브 프리미엄 전체 가격 비교</a>로 이동하세요.
        이 페이지는 <em>비교 기준과 데이터 출처</em>를 설명하는 안내 페이지이며, 순위표는 각 서비스 페이지에 있습니다.
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
        "준비 중"으로 표시된 서비스는 국가별 요금제 구성이 서로 달라 같은 기준으로 정렬하기 어려운 상태입니다.
        비교 가능한 형태로 정리되는 대로 순차적으로 공개합니다.
      </p>

      <h2 class="${H2}">가격을 환산하는 방식</h2>
      <p class="${P}">
        모든 순위는 <strong>개인(프리미엄) 플랜의 월 요금</strong>을 기준으로 계산합니다.
        현지 통화 표시가를 먼저 수집하고, 기준 통화인 ${data.baseCurrency}로 환산한 뒤 다시 원화로 환산해 한 줄에 나란히 놓습니다.
        연 단위로만 판매되는 요금제는 월 환산값을 별도로 표기하며, 표시가에 부가가치세가 포함되는지는 국가 제도에 따라 다릅니다.
      </p>
      <ul class="${UL}">
        <li class="${LI}"><strong>가격 기준일</strong> — ${data.lastUpdated} (요금 자체는 사업자 공지 확인 후 수동 반영)</li>
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

      <h2 class="${H2}">어디부터 보면 되나요</h2>
      <ul class="${UL}">
        <li class="${LI}"><a href="/ott/youtube-premium">전체 국가 가격 비교</a> — ${stats.pricedCount}개국 순위표와 정렬·필터</li>
        <li class="${LI}"><a href="/ott/youtube-premium/trends">가격 변동 트렌드</a> — 최근 인상·인하 국가와 변동 폭</li>
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
        ※ 본 서비스는 Google LLC·YouTube 및 각 OTT 사업자의 공식 제휴 서비스가 아닙니다. 가격 기준일: ${data.lastUpdated}.
      </p>` }];
}

function buildHomeContent() {
  const data = loadData();
  const prices = data.prices
    .filter((p) => p.converted?.individual?.krw)
    .map((p) => ({ ...p, krw: p.converted.individual.krw }))
    .sort((a, b) => a.krw - b.krw);
  const kr = data.prices.find((p) => p.countryCode === "KR");
  const krKrw = kr?.converted?.individual?.krw || 14897;

  const top20 = prices.slice(0, 20);
  const rowsHtml = top20
    .map(
      (p, i) => {
        const savingsPercent = ((krKrw - p.krw) / krKrw * 100).toFixed(1);
        return `<tr>
          <td class="${TD}">${i + 1}위</td>
          <td class="${TD}"><a href="/ott/youtube-premium/${p.countryCode.toLowerCase()}">${p.country}</a></td>
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
      <h1 class="${H1}">유튜브 프리미엄 국가별 가격 비교 (요금 조사 ${data.lastUpdated} 기준)</h1>

      <p class="${P}">
        전 세계 <strong>${prices.length}개 국가</strong>의 유튜브 프리미엄(YouTube Premium) 개인 플랜 가격을 한눈에 비교하는 서비스입니다.
        한국은 현재 월 <strong>${formatKrw(krKrw)}</strong>(부가세 포함)이지만, 국가에 따라
        <strong class="sp-down">월 2천원대</strong>부터 이용할 수 있습니다.
        각 국가의 가격 차이, 한국 대비 절약률을 환율 기준일(${data.exchangeRateDate}) 시점의 환율로 환산해 제공합니다.
      </p>

      <p class="${P}">
        유튜브 프리미엄은 광고 제거·백그라운드 재생·오프라인 저장·YouTube Music Premium까지 포함한 종합 구독 서비스입니다.
        같은 기능·같은 품질이지만 Google이 국가별 구매력·물가·세금·현지 경쟁 환경을 반영해 가격을 차등 책정하고 있어,
        거주 국가에 따라 실제 부담하는 비용이 최대 <strong>8배 이상</strong> 차이가 납니다.
      </p>

      <h2 class="${H2}">가장 저렴한 국가 TOP 20</h2>
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

`,
    },
    {
      id: "home-why",
      live: false,
      html: `      <h2 class="${H2}">왜 국가별 가격이 다를까요?</h2>
      <p class="${P}">
        유튜브 프리미엄은 국가별로 구매력 평가(PPP), 부가세율, 환율, 경쟁 서비스 가격을 종합해 차등 가격 정책을 운영합니다.
        예를 들어 인도는 월 2,374원, 튀르키예는 2,635원으로 한국 가격의 15~20% 수준입니다.
        반면 미국·영국·호주 등 선진국은 오히려 한국보다 비싼 경우가 많습니다.
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
        <li class="${LI}"><strong>44개 국가 요금 한눈에 비교</strong> — 각 국가에서 실제로 제공되는 개인·가족·학생·Lite 플랜 가격을 같은 시점(요금 조사일 ${data.lastUpdated}) 기준으로 비교</li>
        <li class="${LI}"><strong>원화 자동 환산</strong> — 환율 기준일 ${data.exchangeRateDate}의 공개 환율로 원화 비용 확인</li>
        <li class="${LI}"><strong>절약률 계산</strong> — 한국 대비 월·연 절약액 자동 계산</li>
        <li class="${LI}"><strong>가격 트렌드</strong> — 국가별 가격 변동 추이 (<a href="/ott/youtube-premium/trends">트렌드 페이지</a>)</li>
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
        <li class="${LI}"><a href="/ott/youtube-premium/trends">가격 변동 트렌드 분석</a></li>
        <li class="${LI}"><a href="/ott/youtube-premium/in">인도 — 세계 최저가</a></li>
        <li class="${LI}"><a href="/ott/youtube-premium/kr">한국 가격 상세</a></li>
        <li class="${LI}"><a href="/ott/about">서비스 소개 및 데이터 출처</a></li>
      </ul>

      <p class="sp-note">
        ※ 본 서비스는 Google LLC 또는 YouTube의 공식 제휴 서비스가 아닙니다. 요금 조사일: ${data.lastUpdated} · 환율 기준일: ${data.exchangeRateDate}.
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
  const krKrw = kr?.converted?.individual?.krw || 14897;

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

      <h1 class="${H1}">유튜브 프리미엄 국가별 가격 격차 (요금 조사 ${data.lastUpdated} 기준)</h1>
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
        현지 통화 정가는 ${data.lastUpdated}에 조사한 ${prices.length}개국 자료이고,
        원화 환산에 쓴 환율은 ${data.exchangeRateDate} 기준입니다. 두 날짜는 성격이 다르므로 따로 표기합니다.
      </p>
      <div class="${INFO}">
        <strong>데이터 범위 안내</strong> — 본 페이지는 실시간·일 단위 가격 시계열을 제공하지 않으며,
        Google/YouTube의 공식 가격 변경 이력 아카이브도 아닙니다.
        ${
          hasObservedHistory
            ? `관측 이력 ${stats.snapshots.length}회(${stats.snapshots.map((s) => s.date).join(", ")})와 최신 가격표(${data.lastUpdated} 기준 ${prices.length}개국)에서 도출할 수 있는 사실만 제공합니다.`
            : `현재 확보된 요금 조사는 <strong>1회분(${data.lastUpdated} 기준 ${prices.length}개국)</strong>뿐이라, 시점 간 가격 변동은 표시하지 않습니다. 같은 국가를 서로 다른 시점에 두 번 이상 조사해야 변동을 말할 수 있고, 아직 그 조건을 충족하지 못했습니다.`
        }
      </div>

`,
    },
    {
      id: "trends-reading",
      live: false,
      html: `      <h2 class="${H2}">이 페이지가 보여주는 것과 보여주지 않는 것</h2>
      <p class="${P}">
        <strong>보여주는 것</strong> — 요금 조사일(${data.lastUpdated}) 하나를 기준으로 한
        ${prices.length}개국의 개인 플랜 현지 통화 정가와 그 원화 환산값, 그리고 국가 사이의 가격 격차와 순위입니다.
        같은 시점끼리의 비교이므로 "어느 나라가 더 싼가"에는 그대로 답할 수 있습니다.
      </p>
      <p class="${P}">
        <strong>보여주지 않는 것</strong> — 특정 국가의 요금이 언제 얼마나 올랐거나 내렸는지입니다.
        시점 간 변동을 말하려면 같은 국가를 서로 다른 날짜에 두 번 이상 조사한 이력이 있어야 하는데,
        ${
          hasObservedHistory
            ? `현재 관측 이력은 ${stats.snapshots.length}회입니다.`
            : `현재 확보된 요금 조사는 1회분뿐입니다. 그래서 변동률 표를 싣지 않습니다.`
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
    // 뷰의 갱신·보정 기록 표와 FAQ 아코디언과 같은 내용
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
      }      <h2 class="${H2}">자주 묻는 질문 (FAQ)</h2>
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
        ※ 현지 통화 요금은 ${data.lastUpdated}에 조사한 자료이고, 원화 환산에 쓴 환율은 ${data.exchangeRateDate} 기준입니다.
        실시간·일 단위 시계열은 제공하지 않으며, 실제 결제 금액은 Google Play·YouTube 공식 페이지에서 최종 확인해야 합니다.
      </p>`,
    },
  ];
}

function buildAboutContent() {
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
        가격 데이터는 공개된 Google/YouTube 공식 페이지와 각 국가의 공식 요금표를 수집해 정기적으로 갱신합니다.
        모든 가격은 <a href="https://www.youtube.com/premium" target="_blank" rel="noopener noreferrer">YouTube Premium 공식 페이지</a> 등
        각국 공식 요금 페이지와 직접 대조해 검증한 뒤 게재하며,
        요금제·결제 관련 공식 안내는 <a href="https://support.google.com/youtube" target="_blank" rel="noopener noreferrer">YouTube 고객센터</a>에서 확인할 수 있습니다.
        환율은 공개 환율 API를 통해 자동 갱신되며, 본 사이트는 자체 원화 환산 로직을 적용합니다.
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
        요금 조사일: ${loadData().lastUpdated} · 환율 기준일: ${loadData().exchangeRateDate}
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
        OTT Watcher 커뮤니티는 유튜브 프리미엄 등 OTT 구독료 정보를 공유하고, 절약 팁과 이용 경험을 나누는 공간입니다.
        국가별 가격 변동, 합법적인 절약 방법, 요금제 선택 경험 등을 함께 공유해보세요.
      </p>

      <h2 class="${H2}">주요 주제</h2>
      <ul class="${UL}">
        <li class="${LI}"><strong>가격 변동 소식</strong> — 국가별 가격 인상·인하 정보</li>
        <li class="${LI}"><strong>요금제 선택 후기</strong> — 개인 플랜·Lite 플랜 전환 경험담</li>
        <li class="${LI}"><strong>해외 거주자 팁</strong> — 국가별 결제·VAT 주의사항</li>
        <li class="${LI}"><strong>국가별 제공 요금제</strong> — 가족·학생 플랜을 제공하는 국가와 그 조건</li>
      </ul>

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
        커뮤니티 참여는 현재 준비 중이며, 곧 익명 게시판 형태로 오픈 예정입니다.
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
    <article data-seo-prerender="${articleId}" class="${ARTICLE}">${body}
    </article>`;
}

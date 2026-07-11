// OttWatcher 프리렌더 페이지별 리치 콘텐츠 빌더
// 국가별 가격 데이터 기반 800+단어 정적 HTML 생성
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PRICE_DATA_PATH = path.resolve(
  __dirname,
  "../../data/prices/youtube-premium.json"
);

let _data = null;
function loadData() {
  if (_data) return _data;
  _data = JSON.parse(fs.readFileSync(PRICE_DATA_PATH, "utf-8"));
  return _data;
}

// --- 공통 스타일 ---
const ARTICLE = "max-width:920px;margin:0 auto;padding:24px 16px;line-height:1.75;font-size:15px;color:#334155;";
const H1 = "font-size:28px;line-height:1.3;margin:0 0 16px;color:#0f172a;";
const H2 = "font-size:20px;line-height:1.35;margin:28px 0 10px;padding-bottom:6px;border-bottom:2px solid #ef444433;color:#0f172a;";
const H3 = "font-size:16px;line-height:1.4;margin:18px 0 6px;color:#0f172a;";
const P = "margin:0 0 10px;";
const TABLE = "width:100%;border-collapse:collapse;margin:10px 0 16px;font-size:14px;";
const TH = "padding:8px 10px;background:#f1f5f9;text-align:left;border:1px solid #cbd5e1;color:#334155;font-weight:600;";
const TD = "padding:8px 10px;border:1px solid #cbd5e1;";
const UL = "margin:0 0 12px 20px;padding:0;";
const LI = "margin-bottom:4px;";
const CALLOUT = "background:#fef2f2;border-left:4px solid #ef4444;padding:12px 14px;margin:12px 0 16px;border-radius:4px;";
const INFO = "background:#f0fdf4;border-left:4px solid #10b981;padding:12px 14px;margin:12px 0 16px;border-radius:4px;";

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

  const planRowsHtml = planRows
    .map(
      (p) =>
        `<tr>
          <td style="${TD}">${p.name}</td>
          <td style="${TD}">${p.local}</td>
          <td style="${TD}">${p.usd != null ? formatUsd(p.usd) : "-"}</td>
          <td style="${TD}">${p.krw != null ? formatKrw(p.krw) : "-"}</td>
        </tr>`
    )
    .join("");

  // 저장되는 돈 요약 문장
  const savingsSummary = savings
    ? savings.diff > 0
      ? `한국(${formatKrw(krKrw)})보다 월 <strong style="color:#047857;">${formatKrw(savings.diff)}</strong>(${savings.percent.toFixed(1)}%) 저렴하며, 연간 약 ${formatKrw(savings.annual)}을 절약할 수 있습니다.`
      : savings.diff < 0
        ? `한국(${formatKrw(krKrw)})보다 월 <strong style="color:#dc2626;">${formatKrw(-savings.diff)}</strong>(${Math.abs(savings.percent).toFixed(1)}%) 더 비쌉니다.`
        : `한국과 거의 동일한 가격입니다.`
    : "";

  const lastUpdated = data.lastUpdated || "";
  const krwRate = data.krwRate ? `1 USD ≈ ${Math.round(data.krwRate).toLocaleString("ko-KR")}원` : "";

  return `
    <article data-seo-prerender="country" style="${ARTICLE}">
      <nav aria-label="breadcrumb" style="font-size:13px;color:#64748b;margin-bottom:10px;">
        <a href="/ott" style="color:#64748b;text-decoration:none;">홈</a> ›
        <a href="/ott/youtube-premium" style="color:#64748b;text-decoration:none;">유튜브 프리미엄</a> ›
        ${countryName}
      </nav>

      <h1 style="${H1}">유튜브 프리미엄 ${countryName} 가격 (${lastUpdated} 기준)</h1>

      <p style="${P}">
        유튜브 프리미엄 <strong>${countryName}</strong>(${continent}) 개인 플랜은
        현지 통화 기준 <strong>${planRows[0]?.local || "-"}</strong>이며,
        ${krwRate} 환율로 환산하면 월 <strong style="color:#047857;">${countryKrw != null ? formatKrw(countryKrw) : "-"}</strong>입니다.
        ${savingsSummary}
      </p>

      <p style="${P}">
        본 페이지는 ${countryName}의 유튜브 프리미엄 개인 플랜·가족 플랜·Lite 플랜 등 모든 요금제 정보를 제공하며,
        한국 대비 절약률, VPN·지역 변경 우회 이용 시의 약관 위반 위험, 결제 시 주의사항을 함께 안내합니다.
      </p>

      <h2 style="${H2}">1. ${countryName} 유튜브 프리미엄 요금제 전체</h2>
      ${planRows.length > 0
        ? `<table style="${TABLE}">
            <thead>
              <tr>
                <th style="${TH}">플랜</th>
                <th style="${TH}">현지 가격</th>
                <th style="${TH}">USD 환산</th>
                <th style="${TH}">원화 환산</th>
              </tr>
            </thead>
            <tbody>${planRowsHtml}</tbody>
          </table>`
        : `<p style="${P}">이 국가의 상세 요금제 정보가 아직 수집되지 않았습니다.</p>`
      }

      <p style="font-size:12px;color:#64748b;margin-top:-8px;">
        ※ ${krwRate} 기준. 환율은 매일 변동하므로 실제 결제 금액은 해당 통화 원가 × 현재 환율로 계산됩니다.
        최종 업데이트: ${lastUpdated}
      </p>

      <h2 style="${H2}">2. 한국 대비 가격 비교</h2>
      ${savings
        ? `<table style="${TABLE}">
            <tbody>
              <tr>
                <td style="${TD}">한국 개인 플랜(원화)</td>
                <td style="${TD}">${formatKrw(krKrw)}</td>
              </tr>
              <tr>
                <td style="${TD}">${countryName} 개인 플랜(원화)</td>
                <td style="${TD}">${formatKrw(countryKrw)}</td>
              </tr>
              <tr style="background:${savings.diff > 0 ? "#ecfdf5" : "#fef2f2"};">
                <td style="${TD}"><strong>${savings.diff > 0 ? "월 절약액" : "월 추가 부담"}</strong></td>
                <td style="${TD}"><strong>${formatKrw(Math.abs(savings.diff))} (${Math.abs(savings.percent).toFixed(1)}%)</strong></td>
              </tr>
              <tr>
                <td style="${TD}">연간 ${savings.diff > 0 ? "절약액" : "추가 부담"}</td>
                <td style="${TD}">${formatKrw(Math.abs(savings.annual))}</td>
              </tr>
            </tbody>
          </table>`
        : ""
      }

      ${savings && savings.diff > 0
        ? `<div style="${INFO}">
            <strong>절약 포인트</strong> — ${countryName} 요금으로 1년 구독 시 한국 요금 대비 약 ${formatKrw(savings.annual)}을 절약할 수 있습니다.
            단, 결제 수단과 거주지 인증 등의 제약이 있으므로 아래 "이용 시 주의사항"을 반드시 확인하세요.
          </div>`
        : ""
      }

      <h2 style="${H2}">3. 국가별 가격 차이가 생기는 이유</h2>
      <p style="${P}">
        유튜브 프리미엄은 국가별로 구매력 평가(PPP)·물가·환율·세금·현지 경쟁 환경을 반영해 차등 가격 정책을 운영합니다.
        인도·튀르키예·아르헨티나·이집트·베트남·인도네시아 등 개발도상국은 한국 대비 30~80% 저렴한 가격으로 제공되며,
        반대로 미국·영국·스위스·노르웨이 등 고소득 국가는 한국보다 비싼 경우가 많습니다.
      </p>
      <ul style="${UL}">
        <li style="${LI}"><strong>구매력 평가(PPP)</strong>: 현지 평균 소득에 비례한 가격</li>
        <li style="${LI}"><strong>부가가치세(VAT)</strong>: 국가별 세율이 0~25%로 상이</li>
        <li style="${LI}"><strong>환율 변동</strong>: 달러 강세 시 원화 기준 가격 상승</li>
        <li style="${LI}"><strong>현지 경쟁 서비스</strong>: 넷플릭스·스포티파이 등과 경쟁 가격 책정</li>
      </ul>

      <h2 style="${H2}">4. 이용 시 주의사항 (약관 위반 위험)</h2>
      <div style="${CALLOUT}">
        <strong>⚠️ YouTube 이용약관 안내</strong><br>
        Google/YouTube 이용약관에 따르면, 구독자는 "현재 거주지"의 가격을 지불해야 합니다.
        VPN·결제 수단을 이용해 다른 국가의 가격으로 구독하는 것은 이용약관 위반으로 간주될 수 있으며,
        Google이 이를 감지하면 구독 취소·환불 거부·계정 정지 등의 조치가 취해질 수 있습니다.
      </div>
      <p style="${P}">
        다음 상황에서만 ${countryName} 가격을 합법적으로 이용할 수 있습니다.
      </p>
      <ul style="${UL}">
        <li style="${LI}">${countryName}에 실제 거주하거나 장기 체류 중인 경우</li>
        <li style="${LI}">${countryName} 국적·비자를 가진 외국인 노동자·유학생</li>
        <li style="${LI}">${countryName} 현지 결제 수단(은행 계좌·신용카드)을 보유한 경우</li>
        <li style="${LI}">업무·여행 목적으로 해당 국가에서 일시 체류 중인 경우</li>
      </ul>

      <h2 style="${H2}">5. 자주 묻는 질문 (FAQ)</h2>

      <h3 style="${H3}">Q1. ${countryName} 가격으로 구독하려면 어떻게 해야 하나요?</h3>
      <p style="${P}">
        Google 계정의 청구 국가를 ${countryName}으로 변경하고 해당 국가의 결제 수단을 등록해야 합니다.
        단, 청구 국가 변경은 Google 정책상 1년에 1회만 가능하며, 변경 전 기존 구독을 취소하고 잔여 기간이 종료되어야 합니다.
      </p>

      <h3 style="${H3}">Q2. VPN만 사용하면 ${countryName} 가격이 되나요?</h3>
      <p style="${P}">
        아니오. 가격은 VPN이 아닌 "결제 수단 발행 국가"와 "Google 계정 청구 주소"로 결정됩니다.
        한국 카드·주소로는 VPN을 사용해도 ${countryName} 가격을 볼 수 없습니다.
      </p>

      <h3 style="${H3}">Q3. ${countryName}에서 구독 후 한국에서도 이용 가능한가요?</h3>
      <p style="${P}">
        유튜브 프리미엄은 전 세계 대부분의 국가에서 스트리밍 가능합니다. 다만 일부 국가에 영상 시청 지역 제한이 있을 수 있으며,
        장기간 한국 IP에서 접속할 경우 Google이 실제 거주지를 재확인할 수 있습니다.
      </p>

      <h3 style="${H3}">Q4. 한국 신용카드로 ${countryName} 구독 결제가 가능한가요?</h3>
      <p style="${P}">
        원칙적으로 Google 청구 국가와 카드 발행 국가가 일치해야 합니다.
        한국 카드로 ${countryName} 가격 구독을 시도하면 결제 거부 또는 향후 청구 국가 자동 재변경이 발생할 수 있습니다.
      </p>

      <h3 style="${H3}">Q5. ${countryName} 가격은 자주 바뀌나요?</h3>
      <p style="${P}">
        국가별 가격은 환율·물가·부가세 변동에 따라 조정되며, Google이 주기적으로 가격 정책을 재검토합니다.
        본 페이지의 가격은 ${lastUpdated} 기준이며, 실제 결제 시점에 따라 다를 수 있으므로 Google Play·YouTube 공식 페이지에서 최종 확인하세요.
      </p>

      <h2 style="${H2}">6. 다른 저렴한 국가 비교</h2>
      <ul style="${UL}">
        <li style="${LI}"><a href="/ott/youtube-premium/in">인도 (세계 최저가)</a></li>
        <li style="${LI}"><a href="/ott/youtube-premium/tr">튀르키예</a></li>
        <li style="${LI}"><a href="/ott/youtube-premium/ar">아르헨티나</a></li>
        <li style="${LI}"><a href="/ott/youtube-premium/vn">베트남</a></li>
        <li style="${LI}"><a href="/ott/youtube-premium/id">인도네시아</a></li>
        <li style="${LI}"><a href="/ott/youtube-premium">전체 국가 가격 비교</a></li>
      </ul>

      <p style="font-size:12px;color:#64748b;margin-top:24px;">
        ※ 본 페이지 가격 정보는 공개된 출처를 기반으로 수집된 ${lastUpdated} 기준 데이터이며, 실제 Google Play/YouTube 공식 가격과 다를 수 있습니다.
        가격 우회 구독은 약관 위반 위험이 있어 권장하지 않습니다. 본 사이트는 Google 또는 YouTube의 공식 제휴 서비스가 아닙니다.
      </p>
    </article>`;
}

// =========================
// 정적 페이지별 콘텐츠
// =========================

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
          <td style="${TD}">${i + 1}위</td>
          <td style="${TD}"><a href="/ott/youtube-premium/${p.countryCode.toLowerCase()}">${p.country}</a></td>
          <td style="${TD}">${formatKrw(p.krw)}</td>
          <td style="${TD}"><strong style="color:#047857;">-${savingsPercent}%</strong></td>
        </tr>`;
      }
    )
    .join("");

  return `
    <article data-seo-prerender="home" style="${ARTICLE}">
      <h1 style="${H1}">유튜브 프리미엄 국가별 가격 비교 (${data.lastUpdated} 기준)</h1>

      <p style="${P}">
        전 세계 <strong>${prices.length}개 국가</strong>의 유튜브 프리미엄(YouTube Premium) 개인 플랜 가격을 한눈에 비교하는 서비스입니다.
        한국은 현재 월 <strong>${formatKrw(krKrw)}</strong>(부가세 포함)이지만, 국가에 따라
        <strong style="color:#047857;">월 2천원대</strong>부터 이용할 수 있습니다.
        각 국가의 가격 차이, 환율 기준 원화 환산, 한국 대비 절약률을 실시간 환율로 계산해 제공합니다.
      </p>

      <p style="${P}">
        유튜브 프리미엄은 광고 제거·백그라운드 재생·오프라인 저장·YouTube Music Premium까지 포함한 종합 구독 서비스입니다.
        같은 기능·같은 품질이지만 Google이 국가별 구매력·물가·세금·현지 경쟁 환경을 반영해 가격을 차등 책정하고 있어,
        거주 국가에 따라 실제 부담하는 비용이 최대 <strong>8배 이상</strong> 차이가 납니다.
      </p>

      <h2 style="${H2}">가장 저렴한 국가 TOP 20</h2>
      <table style="${TABLE}">
        <thead>
          <tr>
            <th style="${TH}">순위</th>
            <th style="${TH}">국가</th>
            <th style="${TH}">월 가격(원화)</th>
            <th style="${TH}">한국 대비</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>

      <h2 style="${H2}">왜 국가별 가격이 다를까요?</h2>
      <p style="${P}">
        유튜브 프리미엄은 국가별로 구매력 평가(PPP), 부가세율, 환율, 경쟁 서비스 가격을 종합해 차등 가격 정책을 운영합니다.
        예를 들어 인도는 월 2,374원, 튀르키예는 2,635원으로 한국 가격의 15~20% 수준입니다.
        반면 미국·영국·호주 등 선진국은 오히려 한국보다 비싼 경우가 많습니다.
      </p>
      <ul style="${UL}">
        <li style="${LI}"><strong>구매력 평가(PPP)</strong>: 현지 평균 소득에 비례한 가격 책정</li>
        <li style="${LI}"><strong>부가가치세(VAT)</strong>: 국가별 세율이 0~25%로 상이</li>
        <li style="${LI}"><strong>환율 변동</strong>: 달러 강세 시 원화 환산 가격 상승</li>
        <li style="${LI}"><strong>현지 경쟁</strong>: 넷플릭스·스포티파이 등과 경쟁 가격 책정</li>
        <li style="${LI}"><strong>시장 진입 전략</strong>: 신흥 시장 점유율 확보를 위한 저가 정책</li>
      </ul>

      <h2 style="${H2}">서비스 주요 기능</h2>
      <ul style="${UL}">
        <li style="${LI}"><strong>44개 국가 실시간 가격 비교</strong> — 모든 국가의 개인·가족·학생·Lite 플랜 가격</li>
        <li style="${LI}"><strong>원화 자동 환산</strong> — 최신 환율 반영으로 실제 원화 비용 확인</li>
        <li style="${LI}"><strong>절약률 계산</strong> — 한국 대비 월·연 절약액 자동 계산</li>
        <li style="${LI}"><strong>가격 트렌드</strong> — 국가별 가격 변동 추이 (<a href="/ott/youtube-premium/trends">트렌드 페이지</a>)</li>
        <li style="${LI}"><strong>이용 가이드</strong> — 국가별 결제·계정 설정 주의사항</li>
        <li style="${LI}"><strong>법적 주의사항 안내</strong> — 약관 위반 위험과 합법 이용 범위</li>
      </ul>

      <h2 style="${H2}">이용 시 주의사항</h2>
      <div style="${CALLOUT}">
        <strong>⚠️ 약관 위반 주의</strong><br>
        Google/YouTube 이용약관상 구독자는 "실제 거주지 국가"의 가격을 지불해야 합니다.
        VPN 또는 가짜 주소를 이용한 국가 우회 구독은 약관 위반이며, 감지 시 구독 취소·환불 거부·계정 정지 조치가 취해질 수 있습니다.
        본 서비스는 단순 가격 정보 제공 목적이며, 약관 위반 행위를 권장하지 않습니다.
      </div>

      <h2 style="${H2}">자주 묻는 질문 (FAQ)</h2>

      <h3 style="${H3}">Q1. 한국에서 가장 저렴하게 구독하는 방법은 무엇인가요?</h3>
      <p style="${P}">
        합법적인 방법으로는 한국 정상 가격(₩14,900) 또는 "가족 플랜 공유"(최대 5인 한도)가 가장 현실적입니다.
        가족 플랜은 월 22,900원으로 5명이 나누면 1인당 약 4,580원입니다. 이는 개인 플랜보다 약 70% 저렴한 수준입니다.
        학생이라면 학생 할인 플랜(월 8,690원)도 이용할 수 있습니다.
      </p>

      <h3 style="${H3}">Q2. 데이터는 얼마나 자주 업데이트되나요?</h3>
      <p style="${P}">
        가격 정보는 주기적으로 수집해 갱신하며, 환율은 자동 갱신됩니다. 최종 업데이트: <strong>${data.lastUpdated}</strong>.
        Google의 가격 정책 변경 공지가 있을 때마다 수동 확인 후 반영하며, 환율은 공개 환율 API를 통해 매일 자동 업데이트됩니다.
      </p>

      <h3 style="${H3}">Q3. 광고 제거 외에 유튜브 프리미엄의 혜택은?</h3>
      <p style="${P}">
        광고 제거, 백그라운드 재생, 오프라인 저장, YouTube Music Premium 포함, 고품질 오디오(최대 256kbps)가 포함됩니다.
        YouTube Music 단독 구독(월 8,690원)보다 약 6천원만 추가하면 유튜브 광고까지 제거되어 사실상 묶음 할인 혜택이 있습니다.
      </p>

      <h3 style="${H3}">Q4. VPN으로 다른 국가 가격으로 구독이 가능한가요?</h3>
      <p style="${P}">
        원칙적으로 불가능합니다. 가격은 VPN 위치가 아니라 Google 계정의 <strong>청구 국가</strong>와 <strong>결제 수단 발행 국가</strong>로 결정됩니다.
        VPN만 사용해서는 다른 국가의 가격을 볼 수 없으며, 강제로 변경하려 해도 결제가 거부되거나 향후 자동으로 재변경됩니다.
      </p>

      <h3 style="${H3}">Q5. 가족 플랜은 어떻게 공유하나요?</h3>
      <p style="${P}">
        가족 플랜은 한 가구 내 최대 5명(가구주 1명 + 가족 구성원 4명)까지 공유할 수 있습니다.
        Google 계정의 "가족 그룹" 기능을 통해 초대하며, 모든 구성원은 동일 가구 주소에 거주해야 합니다.
        정책상 주소가 다른 친구·지인과의 공유는 금지되며, 감지 시 일부 계정이 제거될 수 있습니다.
      </p>

      <h3 style="${H3}">Q6. 유튜브 프리미엄 라이트(Lite) 플랜이 뭔가요?</h3>
      <p style="${P}">
        Lite 플랜은 일부 국가에서만 제공되는 저가 요금제로, YouTube Music이 제외된 "광고 제거 전용" 플랜입니다.
        가격은 일반 개인 플랜의 약 50~60% 수준이며, 한국에서도 월 8,500원에 이용할 수 있습니다.
      </p>

      <h2 style="${H2}">관련 페이지</h2>
      <ul style="${UL}">
        <li style="${LI}"><a href="/ott/youtube-premium/trends">가격 변동 트렌드 분석</a></li>
        <li style="${LI}"><a href="/ott/youtube-premium/in">인도 — 세계 최저가</a></li>
        <li style="${LI}"><a href="/ott/youtube-premium/kr">한국 가격 상세</a></li>
        <li style="${LI}"><a href="/ott/about">서비스 소개 및 데이터 출처</a></li>
      </ul>

      <p style="font-size:12px;color:#64748b;margin-top:24px;">
        ※ 본 서비스는 Google LLC 또는 YouTube의 공식 제휴 서비스가 아닙니다. 최종 업데이트: ${data.lastUpdated}.
      </p>
    </article>`;
}

function buildTrendsContent() {
  const data = loadData();
  const prices = data.prices
    .filter((p) => p.converted?.individual?.krw)
    .map((p) => ({ ...p, krw: p.converted.individual.krw }))
    .sort((a, b) => a.krw - b.krw);
  const kr = data.prices.find((p) => p.countryCode === "KR");
  const krKrw = kr?.converted?.individual?.krw || 14897;

  return `
    <article data-seo-prerender="trends" style="${ARTICLE}">
      <nav aria-label="breadcrumb" style="font-size:13px;color:#64748b;margin-bottom:10px;">
        <a href="/ott" style="color:#64748b;text-decoration:none;">홈</a> ›
        <a href="/ott/youtube-premium" style="color:#64748b;text-decoration:none;">유튜브 프리미엄</a> ›
        가격 트렌드
      </nav>

      <h1 style="${H1}">유튜브 프리미엄 가격 변동 트렌드 (${data.lastUpdated})</h1>

      <p style="${P}">
        유튜브 프리미엄은 2018년 국내 출시 이후 몇 차례 가격 인상이 있었으며, 전 세계적으로도 평균 30~40% 상승하는 추세입니다.
        본 페이지는 국가별 가격 분포, 지역별 평균 가격, 환율 변동 영향을 종합해 트렌드를 정리합니다.
      </p>

      <h2 style="${H2}">대륙별 평균 가격</h2>
      <p style="${P}">
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
        return `<table style="${TABLE}">
          <thead>
            <tr>
              <th style="${TH}">대륙</th>
              <th style="${TH}">평균 가격</th>
              <th style="${TH}">한국 대비</th>
              <th style="${TH}">국가 수</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r) => {
              const diff = ((krKrw - r.avg) / krKrw * 100).toFixed(1);
              const sign = r.avg < krKrw ? "-" : "+";
              return `<tr>
                <td style="${TD}">${r.continent}</td>
                <td style="${TD}">${formatKrw(r.avg)}</td>
                <td style="${TD}"><strong style="color:${r.avg < krKrw ? '#047857' : '#dc2626'};">${sign}${Math.abs(diff)}%</strong></td>
                <td style="${TD}">${r.count}개국</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>`;
      })()}

      <h2 style="${H2}">저렴한 국가 상위 10위</h2>
      <ol style="${UL}">
        ${prices.slice(0, 10).map((p) => {
          const percent = ((krKrw - p.krw) / krKrw * 100).toFixed(1);
          return `<li style="${LI}"><a href="/ott/youtube-premium/${p.countryCode.toLowerCase()}">${p.country}</a> — ${formatKrw(p.krw)} <span style="color:#047857;">(-${percent}%)</span></li>`;
        }).join("")}
      </ol>

      <h2 style="${H2}">비싼 국가 상위 5위</h2>
      <ol style="${UL}">
        ${prices.slice(-5).reverse().map((p) => {
          const percent = ((p.krw - krKrw) / krKrw * 100).toFixed(1);
          return `<li style="${LI}"><a href="/ott/youtube-premium/${p.countryCode.toLowerCase()}">${p.country}</a> — ${formatKrw(p.krw)} <span style="color:#dc2626;">(+${percent}%)</span></li>`;
        }).join("")}
      </ol>

      <h2 style="${H2}">가격 차이 분석</h2>
      <p style="${P}">
        수집 국가 기준 최저가(${formatKrw(prices[0].krw)}) 대비 최고가(${formatKrw(prices[prices.length - 1].krw)})의 격차는 약 ${((prices[prices.length - 1].krw / prices[0].krw)).toFixed(1)}배에 달합니다.
        이는 Google이 각 국가의 구매력·물가·세율을 종합 반영한 결과이며, 동일 서비스·동일 품질임에도 거주 국가에 따라 비용이 크게 다릅니다.
      </p>
      <p style="${P}">
        참고로 한국은 현재 월 ${formatKrw(krKrw)}로 전 세계 상위 40% 수준의 가격대에 해당합니다.
        반면 북유럽·스위스·호주 등 일부 국가는 월 2만원 이상으로 더 높은 편입니다.
      </p>

      <h2 style="${H2}">관련 링크</h2>
      <ul style="${UL}">
        <li style="${LI}"><a href="/ott/youtube-premium">전체 국가 가격 비교</a></li>
        <li style="${LI}"><a href="/ott/youtube-premium/kr">한국 가격 상세</a></li>
        <li style="${LI}"><a href="/ott/about">서비스 소개 및 데이터 출처</a></li>
      </ul>

      <p style="font-size:12px;color:#64748b;margin-top:24px;">
        ※ 본 데이터는 ${data.lastUpdated} 기준 수집본이며, 환율과 가격 정책 변동에 따라 달라질 수 있습니다.
      </p>
    </article>`;
}

function buildAboutContent() {
  return `
    <article data-seo-prerender="about" style="${ARTICLE}">
      <h1 style="${H1}">서비스 소개 — OTT Watcher</h1>

      <p style="${P}">
        <strong>OTT Watcher</strong>는 유튜브 프리미엄(YouTube Premium) 등 글로벌 OTT 서비스의
        국가별 구독료를 실시간 환율 기준으로 비교 제공하는 무료 서비스입니다.
        회원가입 없이 누구나 이용할 수 있으며, 44개국의 플랜별 상세 가격과 한국 대비 절약률을 한눈에 확인할 수 있습니다.
      </p>

      <p style="${P}">
        본 서비스는 Google/YouTube의 공식 제휴 서비스가 아닌 독립 프로젝트로,
        소비자의 알 권리 보장과 정보 투명성 향상을 목표로 운영됩니다.
        유튜브 프리미엄 이용자가 자신이 지불하는 구독료가 다른 국가와 얼마나 차이나는지 확인할 수 있도록 하고,
        전 세계 가격 정책의 투명성을 높이는 것을 미션으로 합니다.
      </p>

      <h2 style="${H2}">1. 서비스 탄생 배경</h2>
      <p style="${P}">
        대한민국 유튜브 프리미엄 가격은 2018년 출시 이후 지속적으로 인상되어 왔습니다.
        초기 8,690원에서 현재 14,900원으로 약 71% 인상되었으며, 사용자들의 불만이 커지고 있습니다.
        같은 서비스를 이용하는데 인도·튀르키예·아르헨티나 등에서는 2,000~3,000원대로 이용할 수 있다는 사실이 알려지며,
        "왜 한국만 이렇게 비싼가?"라는 소비자의 의문이 제기되었습니다.
      </p>
      <p style="${P}">
        본 서비스는 이러한 소비자 궁금증에 답하기 위해 탄생했습니다.
        단순 가격 비교를 넘어 각 국가의 구매력·세율·경쟁 환경까지 함께 설명해 "왜 이 가격인지" 이해할 수 있도록 돕습니다.
      </p>

      <h2 style="${H2}">2. 제공 정보</h2>
      <ul style="${UL}">
        <li style="${LI}"><strong>44개국 유튜브 프리미엄 가격</strong> — 개인·가족·학생·Duo·Lite 플랜</li>
        <li style="${LI}"><strong>실시간 환율 변환</strong> — 최신 USD/KRW 환율로 자동 환산</li>
        <li style="${LI}"><strong>한국 대비 절약률</strong> — 월·연 단위 절약 가능 금액 계산</li>
        <li style="${LI}"><strong>가격 트렌드 분석</strong> — 대륙별·국가별 평균 가격 분포</li>
        <li style="${LI}"><strong>이용 가이드</strong> — 국가별 결제·계정 설정 주의사항</li>
        <li style="${LI}"><strong>법적 주의사항</strong> — 약관 위반 리스크와 합법 이용 범위 명시</li>
      </ul>

      <h2 style="${H2}">2. 데이터 출처 및 갱신</h2>
      <p style="${P}">
        가격 데이터는 공개된 Google/YouTube 공식 페이지와 각 국가의 공식 요금표를 수집해 정기적으로 갱신합니다.
        환율은 공개 환율 API를 통해 자동 갱신되며, 본 사이트는 자체 원화 환산 로직을 적용합니다.
      </p>

      <h2 style="${H2}">3. 이용 시 주의사항</h2>
      <div style="${CALLOUT}">
        <strong>⚠️ 약관 위반 위험 안내</strong><br>
        Google/YouTube 이용약관에 따르면, 구독자는 "실제 거주지 국가"의 가격을 지불해야 합니다.
        VPN·가짜 주소·타국 결제 수단을 이용한 우회 구독은 약관 위반이며, 감지 시 다음 조치가 취해질 수 있습니다:
        <ul style="margin:8px 0 0 20px;">
          <li>구독 자동 취소</li>
          <li>기존 결제 환불 거부</li>
          <li>Google 계정 경고 또는 일시 정지</li>
          <li>향후 청구 국가 자동 재변경</li>
        </ul>
      </div>
      <p style="${P}">
        본 서비스는 가격 정보 제공 목적이며, 약관 위반 행위를 권장하지 않습니다.
        실제로 해외 거주·체류 중인 사용자만 해당 국가의 가격으로 합법적으로 구독할 수 있습니다.
      </p>

      <h2 style="${H2}">4. 운영자 정보</h2>
      <table style="${TABLE}">
        <tbody>
          <tr>
            <td style="${TD}">운영</td>
            <td style="${TD}">Shakilabs</td>
          </tr>
          <tr>
            <td style="${TD}">서비스 URL</td>
            <td style="${TD}">https://shakilabs.com/ott</td>
          </tr>
          <tr>
            <td style="${TD}">이메일 문의</td>
            <td style="${TD}"><a href="mailto:skdba1313@gmail.com">skdba1313@gmail.com</a></td>
          </tr>
          <tr>
            <td style="${TD}">응답 시간</td>
            <td style="${TD}">영업일 24~48시간 이내</td>
          </tr>
          <tr>
            <td style="${TD}">법적 고지</td>
            <td style="${TD}"><a href="/ott/privacy">개인정보처리방침</a> · <a href="/ott/terms">이용약관</a></td>
          </tr>
        </tbody>
      </table>

      <h2 style="${H2}">5. 수익 구조</h2>
      <p style="${P}">
        본 서비스는 광고(Google AdSense)를 통해 운영비를 충당하며, 사용자에게 이용료를 받지 않습니다.
        광고 수익은 서버·환율 API·데이터 수집 비용에 사용되며, 사용자 개인정보를 판매하지 않습니다.
      </p>

      <h2 style="${H2}">6. 면책 조항</h2>
      <p style="${P}">
        본 서비스에서 제공하는 모든 가격 정보는 참고용이며, 법적 효력이 없습니다.
        실제 결제 가격은 Google Play·YouTube 공식 페이지에서 최종 확인해야 하며,
        환율·세금·할인 이벤트에 따라 본 페이지의 표시 가격과 차이가 있을 수 있습니다.
        본 서비스 이용으로 인한 직접·간접 손실에 대해 책임을 지지 않습니다.
      </p>

      <p style="font-size:12px;color:#64748b;margin-top:24px;">
        최종 업데이트: ${loadData().lastUpdated}
      </p>
    </article>`;
}

function buildPrivacyContent() {
  return `
    <article data-seo-prerender="privacy" style="${ARTICLE}">
      <h1 style="${H1}">개인정보 처리방침</h1>

      <p style="${P}">
        OTT Watcher(이하 "서비스")는 이용자의 개인정보를 소중히 여기며, 관련 법령을 준수합니다.
        본 방침은 서비스 이용 과정에서 수집·이용되는 정보를 안내합니다.
      </p>

      <h2 style="${H2}">1. 수집하는 정보</h2>
      <p style="${P}">
        본 서비스는 별도의 회원가입이 없으며, 직접적인 개인정보를 수집하지 않습니다.
        다만 서비스 운영 과정에서 다음 정보가 자동 수집될 수 있습니다.
      </p>
      <ul style="${UL}">
        <li style="${LI}"><strong>자동 수집</strong>: 접속 IP, 브라우저 종류, 접속 시간, 방문 페이지</li>
        <li style="${LI}"><strong>쿠키</strong>: 선호 국가 저장, Google Analytics 측정 쿠키, Google AdSense 광고 쿠키</li>
      </ul>

      <h2 style="${H2}">2. 이용 목적</h2>
      <ul style="${UL}">
        <li style="${LI}">서비스 통계 및 개선</li>
        <li style="${LI}">악의적 이용 방지</li>
        <li style="${LI}">맞춤형 광고 제공 (Google AdSense)</li>
      </ul>

      <h2 style="${H2}">3. 제3자 서비스</h2>
      <ul style="${UL}">
        <li style="${LI}"><strong>Google Analytics 4</strong> — 익명 방문 통계</li>
        <li style="${LI}"><strong>Google AdSense</strong> — 맞춤 광고 (쿠키 사용)</li>
      </ul>

      <h2 style="${H2}">4. 쿠키 관리</h2>
      <p style="${P}">
        브라우저 설정에서 쿠키 저장을 거부할 수 있으나 일부 기능이 제한될 수 있습니다.
        Google Analytics 수집 거부는 <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">Google Analytics Opt-out Add-on</a>을 이용하세요.
      </p>

      <h2 style="${H2}">5. 보관 및 파기</h2>
      <p style="${P}">
        방문 로그는 Google Analytics 정책에 따라 기본 26개월 보관됩니다.
        서버 액세스 로그는 보안·통계 목적으로 최대 6개월 보관 후 자동 파기됩니다.
      </p>

      <h2 style="${H2}">6. 이용자 권리</h2>
      <p style="${P}">
        이용자는 언제든 본인 관련 정보의 열람·정정·삭제를 요청할 수 있으며,
        문의는 아래 이메일로 가능합니다. 합리적인 기간 내에 처리해 드립니다.
      </p>

      <h2 style="${H2}">7. 문의</h2>
      <ul style="${UL}">
        <li style="${LI}">운영사: Shakilabs</li>
        <li style="${LI}">이메일: <a href="mailto:skdba1313@gmail.com">skdba1313@gmail.com</a></li>
      </ul>

      <p style="font-size:12px;color:#64748b;margin-top:24px;">
        본 방침은 관련 법령 및 서비스 정책 변경 시 개정될 수 있으며, 변경 시 본 페이지에 공지합니다.
      </p>
    </article>`;
}

function buildTermsContent() {
  return `
    <article data-seo-prerender="terms" style="${ARTICLE}">
      <h1 style="${H1}">이용약관</h1>

      <p style="${P}">
        본 약관은 OTT Watcher(이하 "서비스")의 이용 조건과 책임 범위를 규정합니다.
        서비스를 이용함으로써 본 약관에 동의한 것으로 간주됩니다.
      </p>

      <h2 style="${H2}">1. 서비스 개요</h2>
      <p style="${P}">
        OTT Watcher는 유튜브 프리미엄 등 글로벌 OTT 서비스의 국가별 가격 정보를 수집·비교 제공하는 무료 서비스입니다.
        본 서비스는 Google LLC 또는 YouTube의 공식 제휴 서비스가 아닙니다.
      </p>

      <h2 style="${H2}">2. 데이터 정확성</h2>
      <p style="${P}">
        서비스는 공개된 정보를 기반으로 최대한 정확한 데이터를 제공하기 위해 노력합니다.
        그러나 가격·환율·정책은 실시간으로 변동되며, 본 서비스의 데이터와 실제 결제 금액 간에 차이가 있을 수 있습니다.
        최종 가격은 Google Play·YouTube 공식 페이지에서 확인해야 합니다.
      </p>

      <h2 style="${H2}">3. 이용자 책임</h2>
      <p style="${P}">
        본 서비스의 가격 정보를 근거로 VPN·가짜 주소 등을 이용해 타국 가격으로 구독하는 행위는
        Google/YouTube 이용약관 위반이 될 수 있으며, 구독 취소·환불 거부·계정 정지 등의 불이익을 받을 수 있습니다.
        이로 인한 모든 책임은 이용자 본인에게 있으며, 본 서비스는 이를 권장하지 않습니다.
      </p>

      <h2 style="${H2}">4. 면책 조항</h2>
      <p style="${P}">
        본 서비스는 정보 제공을 목적으로 하며, 서비스 이용으로 인해 발생한 직접·간접 손실에 대해 책임을 지지 않습니다.
        서비스는 사전 고지 없이 변경·중단될 수 있으며, 이로 인한 손실은 이용자가 감수합니다.
      </p>

      <h2 style="${H2}">5. 광고</h2>
      <p style="${P}">
        본 서비스는 Google AdSense를 통해 광고를 게재합니다. 광고 클릭으로 발생하는 거래·계약은 광고주와 이용자 간에 이루어지며,
        본 서비스는 이에 관여하지 않습니다.
      </p>

      <h2 style="${H2}">6. 저작권</h2>
      <p style="${P}">
        본 서비스의 디자인·코드·가공된 가격 데이터의 저작권은 Shakilabs에 있으며, 무단 복제·배포를 금지합니다.
        유튜브 관련 상표는 Google LLC의 소유입니다.
      </p>

      <h2 style="${H2}">7. 준거법</h2>
      <p style="${P}">
        본 약관은 대한민국 법령에 따라 해석되며, 분쟁 발생 시 서울중앙지방법원을 관할 법원으로 합니다.
      </p>

      <h2 style="${H2}">8. 개정</h2>
      <p style="${P}">
        본 약관은 필요에 따라 개정될 수 있으며, 개정 시 본 페이지에 공지합니다.
        개정 후에도 서비스를 계속 이용할 경우 개정 약관에 동의한 것으로 간주됩니다.
      </p>

      <p style="font-size:12px;color:#64748b;margin-top:24px;">
        문의: <a href="mailto:skdba1313@gmail.com">skdba1313@gmail.com</a>
      </p>
    </article>`;
}

function buildCommunityContent() {
  return `
    <article data-seo-prerender="community" style="${ARTICLE}">
      <h1 style="${H1}">OTT 구독료 커뮤니티</h1>

      <p style="${P}">
        OTT Watcher 커뮤니티는 유튜브 프리미엄 등 OTT 구독료 정보를 공유하고, 절약 팁과 이용 경험을 나누는 공간입니다.
        국가별 가격 변동, 합법적인 절약 방법, 가족 플랜 공유 후기 등을 함께 공유해보세요.
      </p>

      <h2 style="${H2}">주요 주제</h2>
      <ul style="${UL}">
        <li style="${LI}"><strong>가격 변동 소식</strong> — 국가별 가격 인상·인하 정보</li>
        <li style="${LI}"><strong>가족 플랜 공유 후기</strong> — 합법적 5인 공유 경험담</li>
        <li style="${LI}"><strong>해외 거주자 팁</strong> — 국가별 결제·VAT 주의사항</li>
        <li style="${LI}"><strong>학생 플랜 자격</strong> — 대학 인증 과정 공유</li>
      </ul>

      <h2 style="${H2}">주의사항</h2>
      <p style="${P}">
        VPN·가짜 주소를 이용한 약관 위반 우회 방법 공유는 금지됩니다.
        Google/YouTube 이용약관을 준수하는 합법적인 이용 팁만 공유해주세요.
      </p>

      <h2 style="${H2}">관련 페이지</h2>
      <ul style="${UL}">
        <li style="${LI}"><a href="/ott/youtube-premium">전체 국가 가격 비교</a></li>
        <li style="${LI}"><a href="/ott/youtube-premium/trends">가격 트렌드 분석</a></li>
        <li style="${LI}"><a href="/ott/about">서비스 소개</a></li>
      </ul>

      <p style="${P}">
        커뮤니티 참여는 현재 준비 중이며, 곧 익명 게시판 형태로 오픈 예정입니다.
        문의: <a href="mailto:skdba1313@gmail.com">skdba1313@gmail.com</a>
      </p>
    </article>`;
}

// =========================
// 메인 엔트리
// =========================
export function buildRichContent(route) {
  if (route === "/" || route === "/youtube-premium") {
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

  return null;
}

// OttWatcher 프리렌더 공통 레이아웃: header + footer
// 모든 프리렌더 페이지에 정적 HTML로 주입되어 크롤러의 사이트 항해와 콘텐츠 신호를 보장

/**
 * 공통 헤더 (로고 + 주요 메뉴)
 */
export function buildPrerenderHeader() {
  return `
    <header data-seo-prerender="header" style="max-width:1120px;margin:0 auto;padding:14px 16px;border-bottom:1px solid #e2e8f0;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
        <a href="/ott" style="font-weight:700;font-size:18px;color:#0f172a;text-decoration:none;">OTT Watcher · 구독료 비교</a>
        <nav aria-label="주요 메뉴" style="display:flex;gap:16px;flex-wrap:wrap;font-size:14px;">
          <a href="/ott/youtube-premium" style="color:#334155;text-decoration:none;">유튜브 프리미엄</a>
          <a href="/ott/youtube-premium/trends" style="color:#334155;text-decoration:none;">가격 트렌드</a>
          <a href="/ott/community" style="color:#334155;text-decoration:none;">커뮤니티</a>
          <a href="/ott/about" style="color:#334155;text-decoration:none;">서비스 소개</a>
        </nav>
      </div>
    </header>`;
}

/**
 * 공통 푸터 (주요 국가 링크 + 서비스 안내 + 법적 고지)
 */
export function buildPrerenderFooter() {
  const TOP_COUNTRIES = [
    { code: "in", name: "인도" },
    { code: "tr", name: "튀르키예" },
    { code: "ar", name: "아르헨티나" },
    { code: "vn", name: "베트남" },
    { code: "id", name: "인도네시아" },
    { code: "br", name: "브라질" },
    { code: "ph", name: "필리핀" },
    { code: "th", name: "태국" },
    { code: "tw", name: "대만" },
    { code: "my", name: "말레이시아" },
  ];
  const MAJOR_COUNTRIES = [
    { code: "kr", name: "한국" },
    { code: "us", name: "미국" },
    { code: "gb", name: "영국" },
    { code: "jp", name: "일본" },
    { code: "au", name: "호주" },
    { code: "ca", name: "캐나다" },
    { code: "de", name: "독일" },
    { code: "fr", name: "프랑스" },
    { code: "sg", name: "싱가포르" },
    { code: "hk", name: "홍콩" },
  ];

  const cheapLinks = TOP_COUNTRIES.map(
    (c) =>
      `<li style="margin-bottom:4px;"><a href="/ott/youtube-premium/${c.code}" style="color:#64748b;text-decoration:none;font-size:13px;">${c.name} 가격</a></li>`
  ).join("");
  const majorLinks = MAJOR_COUNTRIES.map(
    (c) =>
      `<li style="margin-bottom:4px;"><a href="/ott/youtube-premium/${c.code}" style="color:#64748b;text-decoration:none;font-size:13px;">${c.name} 가격</a></li>`
  ).join("");

  return `
    <footer data-seo-prerender="footer" style="max-width:1120px;margin:40px auto 0;padding:24px 16px;border-top:1px solid #e2e8f0;background:#f8fafc;">
      <nav aria-label="국가별 페이지" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;margin-bottom:20px;">
        <div>
          <h3 style="font-size:13px;font-weight:700;color:#334155;margin:0 0 8px;">저렴한 국가 TOP 10</h3>
          <ul style="list-style:none;padding:0;margin:0;">${cheapLinks}</ul>
        </div>
        <div>
          <h3 style="font-size:13px;font-weight:700;color:#334155;margin:0 0 8px;">주요 국가</h3>
          <ul style="list-style:none;padding:0;margin:0;">${majorLinks}</ul>
        </div>
        <div>
          <h3 style="font-size:13px;font-weight:700;color:#334155;margin:0 0 8px;">서비스</h3>
          <ul style="list-style:none;padding:0;margin:0;">
            <li style="margin-bottom:4px;"><a href="/ott/youtube-premium" style="color:#64748b;text-decoration:none;font-size:13px;">전체 국가 비교</a></li>
            <li style="margin-bottom:4px;"><a href="/ott/youtube-premium/trends" style="color:#64748b;text-decoration:none;font-size:13px;">가격 트렌드</a></li>
            <li style="margin-bottom:4px;"><a href="/ott/community" style="color:#64748b;text-decoration:none;font-size:13px;">커뮤니티</a></li>
            <li style="margin-bottom:4px;"><a href="/ott/about" style="color:#64748b;text-decoration:none;font-size:13px;">서비스 소개</a></li>
          </ul>
        </div>
      </nav>
      <div style="padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;line-height:1.8;">
        <p style="margin:0 0 6px;">운영 <strong>Shakilabs</strong> · 문의 <a href="mailto:skdba1313@gmail.com" style="color:#64748b;">skdba1313@gmail.com</a></p>
        <p style="margin:0 0 6px;">
          <a href="/ott/about" style="color:#64748b;margin-right:12px;">서비스 소개</a>
          <a href="/ott/privacy" style="color:#64748b;margin-right:12px;">개인정보처리방침</a>
          <a href="/ott/terms" style="color:#64748b;">이용약관</a>
        </p>
        <p style="margin:0 0 6px;">
          본 서비스는 공식 제휴 서비스가 아니며, 유튜브(Google LLC)의 공식 가격 정책과 다를 수 있습니다.
          가격 데이터는 공개된 정보를 수집해 제공하며 실시간 환율 기준으로 원화 환산됩니다.
        </p>
        <p style="margin:0;color:#94a3b8;">
          ⚠️ 국가 변경 우회 구독은 YouTube 이용약관 위반이 될 수 있으니 반드시 현지 거주·체류 조건을 확인 후 이용하시기 바랍니다.
        </p>
      </div>
    </footer>`;
}

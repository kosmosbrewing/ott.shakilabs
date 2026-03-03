# OTT 구독 서비스 국가별 가격 비교 사이트 — MVP 프롬프트

## 프롬프트 (복사용)

```
# 프로젝트: OTT Price Compare (OTT 구독 서비스 국가별 가격 비교 사이트)

## 1. 프로젝트 개요

OTT 구독 서비스의 국가별 구독 요금을 한눈에 비교할 수 있는 웹사이트.
1차 MVP는 유튜브 프리미엄만 다루되, 넷플릭스/디즈니+/스포티파이 등으로 확장 가능한 구조로 설계한다.
DB 없이 JSON 파일로 데이터를 관리한다.

- 목표: 구글 검색 유입(SEO) 기반 AdSense 광고 수익
- 타겟 키워드: "유튜브 프리미엄 가격 비교", "유튜브 프리미엄 싼 나라", "youtube premium cheapest country"
- 수익 모델: Google AdSense
- 1차 범위: 유튜브 프리미엄 × 30개국
- 확장 계획: 넷플릭스, 디즈니+, 스포티파이, 애플TV+, 웨이브, 티빙 등

## 2. 기술 스택

- 프론트엔드: Vue.js 3 (Composition API, Script Setup) + Tailwind CSS + Vite
- 백엔드: Express (Node.js)
- 데이터: JSON 파일 (DB 없음)
- 배포: Vercel 또는 기존 인프라
- 기존 프로젝트 재활용: 샤키샤키 아카이브의 프론트엔드 디자인/레이아웃/컴포넌트 구조를 참고

## 3. 디자인 참고 — 샤키샤키 아카이브

아래 경로의 샤키샤키 아카이브 프론트엔드 코드를 참고하여 동일한 디자인 톤과 컴포넌트 패턴을 유지한다.

참고 경로: ../shakishakiArchive

참고할 항목:
- 전체 레이아웃 구조 (헤더, 푸터, 사이드바 등)
- Tailwind CSS 설정 (tailwind.config.ts의 커스텀 컬러/폰트/spacing)
- 공통 컴포넌트 패턴 (버튼, 카드, 테이블, 모달 등)
- Vue Router 설정 패턴
- API 호출 패턴 (axios/fetch 래퍼)
- 반응형 브레이크포인트 기준
- shadCn 다지안 (Card, Alert 등) 

→ 위 경로의 코드를 먼저 분석한 뒤, 동일한 스타일과 구조를 이 프로젝트에 적용해줘.

## 4. 핵심 기능 (MVP)

- OTT 서비스 선택 (1차: 유튜브 프리미엄만, 확장 시 드롭다운/탭으로 전환)
- 국가별 가격표 (개인/가족/학생 요금제)
- 현지 통화 + USD + KRW 환산 표시
- 한국 대비 절약률(%) 표시
- 가격순 정렬 (싼 순/비싼 순)
- 대륙별 필터링
- 환율 기준일 표시
- 모바일 반응형

## 5. 확장 가능한 데이터 구조

### 핵심 설계 원칙
- 서비스별로 독립된 JSON 파일 1개 = OTT 1개
- 새로운 OTT 추가 = JSON 파일 1개 추가 + services.json에 등록
- 프론트엔드/백엔드 코드 수정 없이 데이터만 추가하면 새 서비스 페이지 자동 생성

### /data/services.json — 서비스 레지스트리
```json
{
  "services": [
    {
      "id": "youtube-premium",
      "name": "YouTube Premium",
      "slug": "youtube-premium",
      "logo": "/images/logos/youtube-premium.svg",
      "color": "#FF0000",
      "plans": [
        { "id": "individual", "name": "개인", "nameEn": "Individual" },
        { "id": "family", "name": "가족", "nameEn": "Family" },
        { "id": "student", "name": "학생", "nameEn": "Student" }
      ],
      "dataFile": "youtube-premium.json",
      "active": true
    },
    {
      "id": "netflix",
      "name": "Netflix",
      "slug": "netflix",
      "logo": "/images/logos/netflix.svg",
      "color": "#E50914",
      "plans": [
        { "id": "ad-supported", "name": "광고형", "nameEn": "Standard with Ads" },
        { "id": "standard", "name": "스탠다드", "nameEn": "Standard" },
        { "id": "premium", "name": "프리미엄", "nameEn": "Premium" }
      ],
      "dataFile": "netflix.json",
      "active": false
    }
  ]
}
```

### /data/prices/youtube-premium.json — 서비스별 가격 데이터
```json
{
  "serviceId": "youtube-premium",
  "lastUpdated": "2026-02-12",
  "exchangeRateDate": "2026-02-12",
  "baseCurrency": "USD",
  "baseCountry": "KR",
  "prices": [
    {
      "country": "한국",
      "countryCode": "KR",
      "continent": "asia",
      "currency": "KRW",
      "plans": {
        "individual": { "monthly": 14900, "yearly": null },
        "family": { "monthly": 23900, "yearly": null },
        "student": { "monthly": 8690, "yearly": null }
      },
      "converted": {
        "individual": { "usd": 10.99, "krw": 14900 },
        "family": { "usd": 17.63, "krw": 23900 },
        "student": { "usd": 6.41, "krw": 8690 }
      }
    },
    {
      "country": "터키",
      "countryCode": "TR",
      "continent": "europe",
      "currency": "TRY",
      "plans": {
        "individual": { "monthly": 79.99, "yearly": null },
        "family": { "monthly": 149.99, "yearly": null },
        "student": { "monthly": 49.99, "yearly": null }
      },
      "converted": {
        "individual": { "usd": 2.31, "krw": 3130 },
        "family": { "usd": 4.33, "krw": 5870 },
        "student": { "usd": 1.44, "krw": 1950 }
      }
    }
  ]
}
```

### /data/exchange-rates.json — 환율 (빌드 시 갱신)
```json
{
  "fetchedAt": "2026-02-12",
  "base": "USD",
  "rates": {
    "KRW": 1355.20,
    "TRY": 34.63,
    "INR": 83.12,
    "ARS": 870.50
  }
}
```

### /data/continents.json — 대륙 매핑
```json
{
  "asia": { "name": "아시아", "nameEn": "Asia" },
  "europe": { "name": "유럽", "nameEn": "Europe" },
  "north-america": { "name": "북미", "nameEn": "North America" },
  "south-america": { "name": "남미", "nameEn": "South America" },
  "africa": { "name": "아프리카", "nameEn": "Africa" },
  "oceania": { "name": "오세아니아", "nameEn": "Oceania" }
}
```

## 6. 페이지 구조 (확장 고려)

```
/                              → 메인: 전체 OTT 서비스 목록 + 요약 비교
/[service-slug]                → 서비스별 가격표 (예: /youtube-premium)
/[service-slug]/[country-code] → 서비스+국가 상세 (예: /youtube-premium/tr)
/compare                       → 서비스 간 비교 (2차 확장)
/country/[code]                → 국가별 전체 OTT 모아보기 (2차 확장)
/about                         → 사이트 소개
/privacy                       → 개인정보처리방침 (애드센스 필수)
```

## 7. 디렉토리 구조

```
ott-price-compare/
├── client/                          # Vue 3 프론트엔드
│   ├── src/
│   │   ├── App.vue
│   │   ├── main.ts
│   │   ├── router/
│   │   │   └── index.js
│   │   ├── views/
│   │   │   ├── HomeView.vue              # 메인: 서비스 목록 (1차에서는 유튜브만)
│   │   │   ├── ServicePriceView.vue      # 서비스별 가격표 (/youtube-premium)
│   │   │   ├── CountryDetailView.vue     # 서비스+국가 상세 (/youtube-premium/tr)
│   │   │   ├── AboutView.vue
│   │   │   └── PrivacyView.vue
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── AppHeader.vue
│   │   │   │   ├── AppFooter.vue
│   │   │   │   └── AdSlot.vue            # 광고 슬롯 (위치별 prop)
│   │   │   ├── price/
│   │   │   │   ├── PriceTable.vue        # 핵심: 가격 비교 테이블
│   │   │   │   ├── PriceRow.vue          # 테이블 행 (국가 1개)
│   │   │   │   ├── SavingsBadge.vue      # 한국 대비 절약률 뱃지
│   │   │   │   └── PlanSelector.vue      # 요금제 탭 (개인/가족/학생)
│   │   │   ├── filter/
│   │   │   │   ├── ContinentFilter.vue   # 대륙별 필터
│   │   │   │   ├── SortToggle.vue        # 정렬 토글
│   │   │   │   └── CurrencyToggle.vue    # KRW/USD 전환
│   │   │   └── common/
│   │   │       ├── ServiceCard.vue       # 메인 페이지 서비스 카드
│   │   │       └── SEOHead.vue           # 메타태그 동적 설정
│   │   ├── composables/
│   │   │   ├── usePrices.js              # 가격 데이터 로드 + 정렬/필터
│   │   │   ├── useServices.js            # 서비스 목록 로드
│   │   │   ├── useCurrency.js            # 통화 변환 유틸
│   │   │   └── useSEO.js                 # 메타태그 설정
│   │   ├── api/
│   │   │   └── index.js                  # API 호출 래퍼 (샤키샤키 패턴 재활용)
│   │   └── assets/
│   │       └── css/
│   │           └── main.css
│   ├── public/
│   │   ├── robots.txt
│   │   ├── favicon.png
│   │   ├── og-image.png
│   │   └── images/
│   │       └── logos/                    # OTT 서비스 로고 SVG
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── package.json
│
├── server/                          # Express 백엔드
│   ├── src/
│   │   ├── app.js                        # Express 앱 설정
│   │   ├── routes/
│   │   │   ├── index.js                  # 라우트 등록
│   │   │   ├── pages.js                  # SEO용 HTML 응답 (메타태그 + OG태그)
│   │   │   └── api/
│   │   │       ├── services.js           # GET /api/services — 서비스 목록
│   │   │       └── prices.js             # GET /api/prices/:serviceSlug — 서비스별 가격
│   │   ├── middleware/
│   │   │   ├── errorHandler.js           # 전역 에러 핸들러
│   │   │   └── seo.js                    # 크롤러 감지 → SSR HTML 응답
│   │   └── utils/
│   │       ├── logger.js                 # 구조화 로깅 (JSON)
│   │       └── meta.js                   # 서비스/국가별 메타태그 생성 유틸
│   ├── package.json
│   └── .env.example
│
├── data/                            # 정적 데이터 (JSON)
│   ├── services.json                     # 서비스 레지스트리
│   ├── continents.json                   # 대륙 매핑
│   ├── exchange-rates.json               # 환율 캐시
│   └── prices/
│       ├── youtube-premium.json          # 1차 MVP
│       ├── netflix.json                  # 2차 확장
│       └── disney-plus.json              # 2차 확장
│
├── scripts/
│   └── fetch-exchange-rates.ts           # 환율 갱신 스크립트
│
├── vercel.json
└── README.md
```

## 8. 확장 패턴 — 새 OTT 서비스 추가 시

새 OTT 추가 시 수정 범위:
1. data/services.json에 서비스 항목 추가 (active: true)
2. data/prices/[slug].json 파일 생성
3. public/images/logos/[slug].svg 로고 추가
4. 끝. 코드 수정 없음.

이것이 가능한 이유:
- 라우터가 동적: /[service-slug] → ServicePriceView가 slug로 JSON 로드
- PriceTable이 서비스 무관: plans 배열을 prop으로 받아 동적 렌더링
- API가 범용: GET /api/prices/:slug → data/prices/[slug].json 읽어서 반환

## 9. SEO 전략

- Express의 seo.js 미들웨어: 크롤러(Googlebot 등) User-Agent 감지 시 메타태그가 포함된 HTML 응답
- 일반 사용자: Vue SPA로 정상 서빙
- 각 페이지별 고유 title, description, og:image
  예: "유튜브 프리미엄 터키 가격 | 월 79.99 TRY (약 3,130원) — 한국 대비 79% 절약"
- JSON-LD 구조화 데이터 (FAQ 스키마)
- sitemap.xml: Express 라우트에서 동적 생성 (서비스×국가 조합)
- 국가별 상세 페이지가 각각 독립적인 SEO 유입 채널 역할

## 10. 광고 배치

- AdSlot 컴포넌트로 위치별 관리 (prop: position="top" | "middle" | "bottom" | "sidebar")
- 가격표 상단: 리더보드 배너
- 가격표 중간 (15개국마다): 인피드 광고
- 국가 상세 페이지 하단: 디스플레이 광고
- 모바일: 하단 앵커 광고

## 11. 개발 순서

1단계: 프로젝트 초기 설정 (client + server 디렉토리, 샤키샤키 아카이브 디자인 분석 및 적용)
2단계: 데이터 파일 작성 (services.json + youtube-premium.json 30개국)
3단계: Express API (서비스 목록 + 가격 데이터 API)
4단계: Vue 메인 페이지 + PriceTable 컴포넌트 (정렬/필터/통화전환)
5단계: 국가별 상세 페이지 + 동적 라우팅
6단계: SEO (메타태그, sitemap.xml, robots.txt, JSON-LD, 크롤러 감지 미들웨어)
7단계: AdSense 코드 삽입 + 배포

## 12. .env.example

```
NODE_ENV=production
PORT=6002
SITE_URL=https://shakilabs.com
ADSENSE_PUBLISHER_ID=ca-pub-xxxxxxxx
```

샤키샤키 아카이브 프론트엔드 코드를 먼저 분석하고, 1단계부터 시작해줘.
코드 주석은 한국어, 변수명/함수명은 영어로 작성해줘.
```

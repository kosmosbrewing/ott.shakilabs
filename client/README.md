# OTT 가격 비교

국가별 YouTube Premium 가격과 환율 환산, 한국 대비 차이를 제공하는 Vue 3 SSG 서비스다.

## 운영 상태

- 공개 URL: `https://shakilabs.com/ott`
- 개발 포트: `6102`
- sitemap: 50 indexable URLs
- 공통 UI: `@shakilabs/ui` `0.3.7` exact artifact
- 데이터: 정적 가격 snapshot 우선, API 성공 시 검증된 최신 데이터로 보강
- current main: `2405055` (2026-07-14 점검)

## 개발

```bash
npm ci
npm run dev
npm run typecheck
npm test
npm run build
```

route별 정적 HTML, canonical, sitemap과 unknown 404를 build gate에서 유지한다. 상위 `ARCHITECTURE.md`는 최초 설계 입력을 보존한 historical snapshot이다.

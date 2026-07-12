# 텍스트 배치 개선 결과

## 결과
- 대상: OTT Watcher 11개 라우트, 브라우저 57개 상태.
- 최종 판정: page overflow, 값·단위/컨트롤 줄바꿈, 텍스트 overflow, 고아줄, 슬라이더 오류 모두 0건.
- `npm run typecheck` → `npm test` → `npm run build` 통과, 14개 테스트 통과.

## 적용 내용
- 가격·국가 표는 모바일에서 내부 스크롤을 사용하고 숫자와 국가명이 한 글자 열로 축소되지 않게 했습니다.
- 순위 번호와 절약 배지의 고정 폭을 내용 기반 최소 폭으로 바꿨습니다.
- 제목은 어절 우선, 본문은 고아줄을 줄이는 자연 줄바꿈을 사용합니다.

## 관련 코드
- [main.css](../../client/src/assets/css/main.css)
- [TrendsView.vue](../../client/src/views/TrendsView.vue)
- [PriceRow.vue](../../client/src/components/price/PriceRow.vue)
- [SavingsBadge.vue](../../client/src/components/price/SavingsBadge.vue)

근거: `../../../artifacts/text-layout-audit/final-consolidated-summary.json`, `../../../artifacts/text-layout-audit/screenshots/final-evidence/targets/`. 열린 이슈는 [issues.json](./issues.json)입니다.

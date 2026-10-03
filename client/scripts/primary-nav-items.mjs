// 2차 내비(데스크톱 탭) · 모바일 ☰ 드로어 · 프리렌더 정적 쌍둥이가 공유하는 단일 출처.
//
// 왜 scripts/에 두나: 프리렌더 레이아웃(prerender-layout.mjs)은 Node에서 돌아 .ts를 읽지 못한다.
// 목록을 양쪽에 적어 두면 한쪽만 바뀌고, 그 어긋남은 드로어를 열어 보기 전까지 어느 게이트에도 걸리지 않는다.
//
// 0.3.38 "순수 내비게이션": 탭은 페이지로만 간다. 예전 탭의 #compare·#ranking·#faq(같은 페이지 앵커)와
// "내 기준 설정"(모달 열기)은 빠졌다 — 패키지 드로어는 action 항목을 눌러도 아무 일도 하지 않는
// 버튼으로 그리고, 커뮤니티는 백엔드가 없어 링크 자체를 끊었다.

/** @type {readonly {key: string, label: string, to: string}[]} */
export const PRIMARY_NAV_ITEMS = [
  { key: "youtube-premium", label: "유튜브 프리미엄 요금", to: "/youtube-premium" },
  { key: "trends", label: "국가별 가격 격차", to: "/youtube-premium/trends" },
];

/**
 * 현재 경로의 탭. 국가 변형(/youtube-premium/kr)은 요금표 탭에 속하고,
 * /youtube-premium/trends는 접두어가 같아도 격차 탭이므로 긴 경로부터 판정한다.
 */
export function findActiveNavItem(path) {
  const normalized = path.replace(/\/+$/, "") || "/";
  return [...PRIMARY_NAV_ITEMS]
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => normalized === item.to || normalized.startsWith(`${item.to}/`));
}

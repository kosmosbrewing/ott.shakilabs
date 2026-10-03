/**
 * 기능 플래그.
 *
 * 커뮤니티(익명 글·댓글·국가 투표)는 백엔드에 community 라우트가 없어 라이브에서 404가 났고,
 * 브라우저는 그것을 CORS 실패로 받아 "Failed to fetch"를 화면에 그대로 띄웠다(2026-09-27 외부 점검).
 * 예전 판정 `import.meta.env.PROD || 플래그`는 프로덕션이면 플래그와 무관하게 켜져 있었다.
 * 이제 명시적으로 켠 빌드에서만 렌더하고, 꺼져 있으면 위젯·링크·요청을 전부 만들지 않는다(오류 문구 0).
 */
export const COMMUNITY_ENABLED = import.meta.env.VITE_ENABLE_COMMUNITY_API === "true";

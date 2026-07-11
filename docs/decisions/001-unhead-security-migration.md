# ADR-001: Unhead 보안 마이그레이션

- 상태: Accepted
- 기준일: 2026-07-11

## 배경

`@vueuse/head`가 취약한 구버전 `@unhead/vue`와 `unhead`를 고정해 `npm audit`에서 URI scheme sanitization 관련 취약점 3건이 검출됐다. 이 앱은 SEO 메타 태그를 런타임에 구성하므로 head manager를 제거할 수 없다.

## 결정

이미 다른 ShakiLabs 앱에서 사용 중인 공식 후속 패키지 `@unhead/vue`로 직접 전환한다. `createHead`와 `useHead` 공개 API는 유지하고 lockfile로 실제 설치 버전을 고정한다.

## 결과

- 취약한 호환 패키지 체인을 제거한다.
- 기존 SEO composable과 앱 초기화 구조를 유지한다.
- typecheck, test, build, static prerender, `npm audit`를 회귀 gate로 사용한다.

## 롤백

문제가 생기면 이 커밋을 되돌려 이전 lockfile과 import를 복원한다.

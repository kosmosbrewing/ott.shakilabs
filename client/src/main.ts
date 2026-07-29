import { createApp } from "vue";
import { createHead } from "@unhead/vue/client";
import App from "./App.vue";
import router from "./router";
import "./assets/css/main.css";
import "@shakilabs/ui/styles.css";
import { initAnalytics } from "./lib/analytics";
import { captureSentryException, initSentry } from "./lib/sentry";
import { removePrerenderFallback } from "./utils/prerenderFallback";

function bootstrap(): void {
  const app = createApp(App);
  const head = createHead();

  app.use(router);
  app.use(head);
  initSentry(app);

  // 라우트 컴포넌트(비동기 청크)가 준비된 뒤에 마운트한다.
  // 먼저 마운트하면 헤더·푸터만 있는 빈 셸이 한 프레임 노출되고, 이어서 본문이 채워지며
  // 푸터가 2,500px 넘게 밀려나 레이아웃 시프트(CLS 0.103)가 발생했다.
  // 준비될 때까지는 프리렌더 폴백이 화면을 채우므로 빈 화면 구간도 생기지 않는다.
  const mountApp = (): void => {
    app.mount("#app");
    removePrerenderFallback();
  };

  router
    .isReady()
    .then(mountApp)
    .catch((error) => {
      captureSentryException(error, "router-ready");
      mountApp();
    });

  // GA 초기화를 LCP 이후로 미룸 — 초기 네트워크 경쟁 제거
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(() => initAnalytics(), { timeout: 4000 });
  } else {
    setTimeout(() => initAnalytics(), 0);
  }
}

try {
  bootstrap();
} catch (error) {
  captureSentryException(error, "bootstrap");
  console.error("[bootstrap] failed", error);
}

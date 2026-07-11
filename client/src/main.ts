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
  app.mount("#app");
  removePrerenderFallback();

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

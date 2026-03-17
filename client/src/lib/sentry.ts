import type { App as VueApp } from "vue";
import * as Sentry from "@sentry/vue";

let hasInitializedSentry = false;

function getSentryDsn(): string {
  return import.meta.env.VITE_SENTRY_DSN?.trim() || "";
}

export function initSentry(app: VueApp): void {
  if (import.meta.env.SSR || typeof window === "undefined" || hasInitializedSentry) return;

  const dsn = getSentryDsn();
  if (!dsn) return;

  Sentry.init({
    app,
    dsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
  });

  hasInitializedSentry = true;
}

export function captureSentryException(error: unknown, source?: string): void {
  if (import.meta.env.SSR || typeof window === "undefined" || !hasInitializedSentry) return;
  Sentry.captureException(error, source ? { tags: { source } } : undefined);
}

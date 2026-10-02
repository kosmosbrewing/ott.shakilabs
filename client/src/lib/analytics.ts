type GtagFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: GtagFn;
    __ga4Initialized?: boolean;
  }
}

const GA_MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]{4,}$/;
const GA_DEBUG_MODE = import.meta.env.DEV && import.meta.env.VITE_GA_DEBUG === "true";

function normalizeMeasurementId(value: unknown): string {
  if (typeof value !== "string") return "";

  let normalized = value.trim();
  if (
    (normalized.startsWith("\"") && normalized.endsWith("\"")) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }

  return normalized.toUpperCase();
}

const GA_MEASUREMENT_ID = normalizeMeasurementId(
  import.meta.env.VITE_GA_MEASUREMENT_ID || import.meta.env.VITE_GA4_MEASUREMENT_ID || ""
);
let gaWarningPrinted = false;
let lastTrackedPath = "";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function ensureGlobalGtag(): void {
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function gtagShim(..._args: unknown[]) {
      // Keep the official gtag bootstrap behavior:
      // function gtag(){dataLayer.push(arguments);}
      window.dataLayer.push(arguments);
    } as GtagFn;
  }
}

function injectGaScript(measurementId: string): void {
  const selector = `script[data-ga4-id="${measurementId}"]`;
  if (document.querySelector(selector)) return;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  script.setAttribute("data-ga4-id", measurementId);
  script.onload = () => {
    if (GA_DEBUG_MODE) {
      console.info("[ga4] gtag script loaded", { measurementId });
    }
  };
  script.onerror = () => {
    if (!gaWarningPrinted) {
      console.warn("[ga4] gtag script load failed. Check blocker/CSP/network.");
      gaWarningPrinted = true;
    }
  };
  document.head.appendChild(script);
}

function canTrackAnalytics(): boolean {
  // 자동화 브라우저(Playwright·헤드리스 점검)는 수집하지 않는다 — 2026-09 라이브 점검 2건이 192페이지를 각 2회 렌더해
  // 28일 조회의 약 8%를 만들었다. GA4 봇 필터(IAB 목록)는 헤드리스 크롬을 거르지 않는다.
  if (typeof navigator !== "undefined" && navigator.webdriver) return false;
  if (!GA_MEASUREMENT_ID) {
    if (!gaWarningPrinted) {
      console.warn(
        "[ga4] measurement id missing. Set VITE_GA_MEASUREMENT_ID in Vercel/Env."
      );
      gaWarningPrinted = true;
    }
    return false;
  }

  if (!GA_MEASUREMENT_ID_PATTERN.test(GA_MEASUREMENT_ID)) {
    if (!gaWarningPrinted) {
      console.warn(`[ga4] invalid measurement id: "${GA_MEASUREMENT_ID}"`);
      gaWarningPrinted = true;
    }
    return false;
  }

  return true;
}

export function initAnalytics(): boolean {
  if (!isBrowser() || !canTrackAnalytics()) return false;
  if (window.__ga4Initialized) return true;

  injectGaScript(GA_MEASUREMENT_ID);
  ensureGlobalGtag();

  if (!window.gtag) return false;

  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID, {
    send_page_view: false,
  });

  window.__ga4Initialized = true;
  return true;
}

// GA4 page_path 정규화 — 같은 화면이 여러 줄로 쪼개지던 두 결함을 막는다(2026-10-02 GA4 28일 표).
// ① 라우터 afterEach는 base 없는 경로(/repayment)를, 첫 로드는 base 있는 경로(/loan/repayment)를 보내
//    page_view와 이후 이벤트가 다른 줄에 찍혔다(seller/shipping-compare: 사용자 47명인데 조회 8회).
// ② 금액 파라미터 경로(/finance/insurance/104250)가 페이지 하나를 60줄로 쪼갰다 — 숫자 세그먼트는 떼고
//    page_variant로 보낸다. 글자 세그먼트(/fuel-card/kb, /eitc/single)는 별개 화면이라 그대로 둔다.
const APP_BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
let lastPageVariant = "";

export function normalizePagePath(rawPath: string): string {
  const pathname = (rawPath || "/").split(/[?#]/, 1)[0] || "/";
  const withBase = APP_BASE && !pathname.startsWith(`${APP_BASE}/`) && pathname !== APP_BASE
    ? `${APP_BASE}${pathname === "/" ? "" : pathname}`
    : pathname;
  const segments = withBase.split("/");
  const numeric = segments.filter((segment) => /^\d+$/.test(segment));
  lastPageVariant = numeric.join("/");
  const kept = segments.filter((segment) => !/^\d+$/.test(segment)).join("/");
  return (kept || "/").replace(/\/$/, "") || "/";
}

export function trackPageView(path: string, title?: string): void {
  if (!isBrowser() || !canTrackAnalytics()) return;
  if (!window.__ga4Initialized) initAnalytics();
  if (!window.gtag) return;

  const normalizedPath = normalizePagePath(path || window.location.pathname);
  if (normalizedPath === lastTrackedPath) return;
  lastTrackedPath = normalizedPath;

  const payload = {
    page_title: title || document.title,
    page_path: normalizedPath,
    page_location: `${window.location.origin}${normalizedPath}`,
    ...(lastPageVariant ? { page_variant: lastPageVariant } : {}),
    ...(GA_DEBUG_MODE ? { debug_mode: true } : {}),
  };
  window.gtag("event", "page_view", payload);

  if (GA_DEBUG_MODE) {
    console.info("[ga4] page_view", {
      measurementId: GA_MEASUREMENT_ID,
      queueSize: window.dataLayer?.length || 0,
      ...payload,
    });
  }
}

export function trackEvent(eventName: string, params?: Record<string, unknown>): void {
  if (!isBrowser() || !canTrackAnalytics()) return;
  if (!window.__ga4Initialized) initAnalytics();
  if (!window.gtag) return;

  const payload = {
    ...(params || {}),
    ...(GA_DEBUG_MODE ? { debug_mode: true } : {}),
  };
  window.gtag("event", eventName, payload);

  if (GA_DEBUG_MODE) {
    console.info("[ga4] event", {
      measurementId: GA_MEASUREMENT_ID,
      eventName,
      queueSize: window.dataLayer?.length || 0,
      ...payload,
    });
  }
}

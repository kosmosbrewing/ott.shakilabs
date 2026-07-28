export type AnalyticsEventTracker = (
  eventName: string,
  params: Record<string, unknown>,
) => void;

interface CalculatorAnalyticsOptions {
  calculatorId: () => string;
  pagePath: () => string;
  track: AnalyticsEventTracker;
  canViewResult?: () => boolean;
  debounceMs?: number;
}

export function createCalculatorAnalytics(options: CalculatorAnalyticsOptions) {
  let started = false;
  let resultTimer: ReturnType<typeof setTimeout> | null = null;

  function buildParams() {
    return {
      calculator_id: options.calculatorId(),
      page_path: options.pagePath(),
      calculation_mode: "automatic",
    };
  }

  function recordInteraction() {
    if (!started) {
      options.track("calculator_start", buildParams());
      started = true;
    }

    if (resultTimer) clearTimeout(resultTimer);
    resultTimer = setTimeout(() => {
      const params = buildParams();
      options.track("calculator_submit", params);
      if (options.canViewResult?.() !== false) {
        options.track("result_view", params);
      }
    }, options.debounceMs ?? 600);
  }

  function dispose() {
    if (resultTimer) clearTimeout(resultTimer);
  }

  return { recordInteraction, dispose };
}

function countVisibleModules({
  frontPage,
  quickWeather,
  marketSummary,
  upAheadSummary,
}) {
  return [
    frontPage.length > 0,
    Boolean(quickWeather),
    Boolean(marketSummary?.primary),
    Boolean(
      upAheadSummary?.event ||
      upAheadSummary?.alert ||
      upAheadSummary?.offer ||
      upAheadSummary?.release
    ),
  ].filter(Boolean).length;
}

export function evaluateMainSlo(input = {}) {
  const data = input?.data || input || {};

  const frontPage = Array.isArray(data.frontPage) ? data.frontPage : [];
  const quickWeather = data.quickWeather || null;
  const marketSummary = data.marketSummary || null;
  const upAheadSummary = data.upAheadSummary || null;
  const insightSummary = data.insightSummary || null;
  const topline = Array.isArray(data.topline) ? data.topline : [];
  const adapterOnly = data.adapterOnly === true;

  const visibleModuleCount = countVisibleModules({
    frontPage,
    quickWeather,
    marketSummary,
    upAheadSummary,
  });

  const hasGoodFrontPage = frontPage.length >= 5;
  const hasEnoughModules = visibleModuleCount >= 2;

  const reasons = [];
  const warnings = [];

  if (!adapterOnly) {
    reasons.push('main_adapter_only_flag_missing');
  }

  if (!hasGoodFrontPage && !hasEnoughModules) {
    reasons.push('main_insufficient_visible_modules');
  }

  if (
    frontPage.length === 0 &&
    !quickWeather &&
    !marketSummary?.primary &&
    !upAheadSummary?.event &&
    !upAheadSummary?.alert
  ) {
    reasons.push('main_no_visible_content');
  }

  if (frontPage.length > 0 && frontPage.length < 5) {
    warnings.push('main_front_page_low_count');
  }

  if (!quickWeather) {
    warnings.push('main_weather_missing');
  }

  if (!marketSummary?.primary) {
    warnings.push('main_market_missing');
  }

  if (!upAheadSummary?.event && !upAheadSummary?.alert && !upAheadSummary?.offer && !upAheadSummary?.release) {
    warnings.push('main_upAhead_missing');
  }

  if (insightSummary?.skipped) {
    warnings.push('main_insight_skipped_adapter_only');
  }

  return {
    id: 'mainSlo',
    required: true,
    passed: reasons.length === 0,
    penalty: 45,
    score: reasons.length === 0
      ? Math.max(60, 100 - warnings.length * 4)
      : 0,
    reasons: [...new Set(reasons)],
    warnings,
    metrics: {
      frontPageCount: frontPage.length,
      toplineCount: topline.length,
      visibleModuleCount,
      hasWeather: Boolean(quickWeather),
      hasMarket: Boolean(marketSummary?.primary),
      hasUpAhead: Boolean(
        upAheadSummary?.event ||
        upAheadSummary?.alert ||
        upAheadSummary?.offer ||
        upAheadSummary?.release
      ),
      insightSkipped: Boolean(insightSummary?.skipped),
      adapterOnly,
    },
  };
}

export const __mainSloInternalsForTest = {
  countVisibleModules,
};

export function evaluatePlannerSlo(input = {}) {
  const data = input?.data || input || {};

  const reasons = [];
  const warnings = [];

  if (!Array.isArray(data.plannedItems)) {
    reasons.push('planner_plannedItems_not_array');
  }

  if (!Array.isArray(data.blacklist)) {
    reasons.push('planner_blacklist_not_array');
  }

  if (!Array.isArray(data.calendarExportableItems)) {
    reasons.push('planner_calendarExportableItems_not_array');
  }

  if (!Array.isArray(data.invalidItems)) {
    reasons.push('planner_invalidItems_not_array');
  }

  if (reasons.length > 0) {
    return {
      id: 'plannerSlo',
      required: false,
      passed: false,
      penalty: 15,
      score: 0,
      reasons,
      warnings,
      metrics: {
        plannedItemCount: 0,
        watchlistCount: 0,
        blacklistCount: 0,
        calendarExportableCount: 0,
        invalidItemCount: 0,
        statefulStorage: true,
      },
    };
  }

  const plannedItems = data.plannedItems;
  const blacklist = data.blacklist;
  const calendarExportableItems = data.calendarExportableItems;
  const invalidItems = data.invalidItems;
  const watchlist = Array.isArray(data.watchlist) ? data.watchlist : [];

  if (plannedItems.length > 0 && calendarExportableItems.length === 0) {
    warnings.push('planner_no_calendar_exportable_items');
  }

  if (invalidItems.length > 0) {
    warnings.push(`planner_invalid_items:${invalidItems.length}`);
  }

  if (blacklist.length > 50) {
    warnings.push('planner_blacklist_unusually_large');
  }

  return {
    id: 'plannerSlo',
    required: false,
    passed: true,
    penalty: 15,
    score: Math.max(60, 100 - warnings.length * 5),
    reasons,
    warnings,
    metrics: {
      plannedItemCount: plannedItems.length,
      watchlistCount: watchlist.length,
      blacklistCount: blacklist.length,
      calendarExportableCount: calendarExportableItems.length,
      invalidItemCount: invalidItems.length,
      statefulStorage: true,
    },
  };
}

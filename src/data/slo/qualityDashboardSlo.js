/**
 * Quality dashboard SLO evaluator.
 *
 * Required: when insight report has stories, dashboard must have matching totalStories > 0.
 * Warning: when insight report has source groups but dashboard has zero source groups.
 */

export function evaluateQualityDashboardSlo(metrics) {
  const {
    reportStoryCount = 0,
    dashboardTotalStories = 0,
    reportSourceGroupCount = 0,
    dashboardSourceGroups = 0,
  } = metrics || {};

  const reasons = [];
  const warnings = [];
  let score = 100;

  // Required: dashboard must not be zero when report is nonzero
  if (reportStoryCount > 0 && dashboardTotalStories === 0) {
    reasons.push('dashboard_inconsistent_with_insight_report');
    score -= 60;
  }

  // Warning: source groups mismatch (not required failure)
  if (reportSourceGroupCount > 0 && dashboardSourceGroups === 0) {
    warnings.push('dashboard_source_groups_missing');
  }

  // Warning: no stories at all in either
  if (reportStoryCount === 0 && dashboardTotalStories === 0) {
    warnings.push('quality_data_empty');
  }

  const bounded = Math.max(0, Math.min(100, score));
  const passed = reasons.length === 0;

  return {
    id: 'qualityDashboardSlo',
    required: true,
    passed,
    score: bounded,
    reasons,
    warnings,
    metrics: {
      reportStoryCount,
      dashboardTotalStories,
      reportSourceGroupCount,
      dashboardSourceGroups,
    },
  };
}

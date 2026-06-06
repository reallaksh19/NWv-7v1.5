/**
 * validate_quality_dashboard.mjs
 *
 * Post-generation SLO gate for quality_dashboard.json.
 * Run after generate_quality_dashboard.mjs.
 *
 * Exits 1 if:
 * - Dashboard file missing
 * - insight quality report has stories but dashboard has zero totalStories
 * - Warns if source groups in report but zero in dashboard
 */

import fs from 'node:fs';
import path from 'node:path';

const NEWSDATA_DIR = path.resolve('public/newsdata');

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function extractStoryCount(report) {
  if (!report) return 0;

  return toNumber(
    report.storyCount ??
    report.stories ??
    report.totalStories ??
    report.latest?.storyCount ??
    report.latest?.totalStories ??
    report.summary?.storyCount ??
    report.summary?.totalStories ??
    report.metrics?.storyCount ??
    report.metrics?.totalStories ??
    0
  );
}

function extractSourceGroupCount(report) {
  if (!report) return 0;

  return toNumber(
    report.sourceGroupCount ??
    report.sourceGroups ??
    report.latest?.sourceGroupCount ??
    report.latest?.sourceGroups ??
    report.summary?.sourceGroupCount ??
    report.summary?.sourceGroups ??
    0
  );
}

function main() {
  const dashboardPath = path.join(NEWSDATA_DIR, 'quality_dashboard.json');

  if (!fs.existsSync(dashboardPath)) {
    console.error('[validate_quality_dashboard] FAIL: quality_dashboard.json not found at', dashboardPath);
    process.exit(1);
  }

  const dashboard = readJson(dashboardPath, null);

  if (!dashboard) {
    console.error('[validate_quality_dashboard] FAIL: quality_dashboard.json is not valid JSON');
    process.exit(1);
  }

  const insightQuality = readJson(path.join(NEWSDATA_DIR, 'insight_quality_report.json'), {});
  const realInsightQuality = readJson(path.join(NEWSDATA_DIR, 'real_insight_quality_report.json'), {});

  const reportStoryCount = Math.max(
    extractStoryCount(insightQuality),
    extractStoryCount(realInsightQuality)
  );

  const reportSourceGroupCount = Math.max(
    extractSourceGroupCount(insightQuality),
    extractSourceGroupCount(realInsightQuality)
  );

  const dashboardTotalStories = toNumber(
    dashboard?.latest?.totalStories ??
    dashboard?.totalStories ??
    0
  );

  const dashboardSourceGroups = toNumber(
    dashboard?.latest?.sourceGroups ??
    dashboard?.sourceGroups ??
    0
  );

  // Required check: report has stories → dashboard must not be zero
  if (reportStoryCount > 0 && dashboardTotalStories === 0) {
    console.error(
      '[validate_quality_dashboard] FAIL: dashboard_inconsistent_with_insight_report',
      { reportStoryCount, dashboardTotalStories }
    );
    process.exit(1);
  }

  // Warning: source group mismatch
  if (reportSourceGroupCount > 0 && dashboardSourceGroups === 0) {
    console.warn(
      '[validate_quality_dashboard] WARN: dashboard has zero source groups while report has',
      reportSourceGroupCount,
      'source groups.',
      { reportSourceGroupCount, dashboardSourceGroups }
    );
    // Do not exit — source group mismatch is a warning, not a failure
  }

  console.log(
    '[validate_quality_dashboard] PASS',
    { dashboardTotalStories, reportStoryCount, dashboardSourceGroups, reportSourceGroupCount }
  );
}

main();

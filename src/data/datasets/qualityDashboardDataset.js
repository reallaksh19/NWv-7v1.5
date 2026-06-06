import {
  makeEnvelope,
  ENVELOPE_SOURCES,
  ENVELOPE_FRESHNESS,
} from '../dataEnvelope.js';
import { fetchJson, publicDataUrl } from '../fetchClient.js';

function getStoryCountFromReport(report) {
  return Number(
    report?.storyCount ??
    report?.stories ??
    report?.totalStories ??
    report?.latest?.storyCount ??
    report?.latest?.totalStories ??
    report?.summary?.storyCount ??
    report?.summary?.totalStories ??
    report?.metrics?.storyCount ??
    report?.metrics?.totalStories ??
    report?.quality?.storyCount ??
    report?.quality?.totalStories ??
    0
  );
}

function getSourceGroupCountFromReport(report) {
  return Number(
    report?.sourceGroupCount ??
    report?.sourceGroups ??
    report?.latest?.sourceGroupCount ??
    report?.latest?.sourceGroups ??
    report?.summary?.sourceGroupCount ??
    report?.summary?.sourceGroups ??
    report?.metrics?.sourceGroupCount ??
    report?.metrics?.sourceGroups ??
    report?.quality?.sourceGroupCount ??
    report?.quality?.sourceGroups ??
    0
  );
}

function getDashboardTotalStories(dashboard) {
  return Number(
    dashboard?.latest?.totalStories ??
    dashboard?.latest?.storyCount ??
    dashboard?.totalStories ??
    dashboard?.storyCount ??
    dashboard?.summary?.totalStories ??
    dashboard?.summary?.storyCount ??
    dashboard?.metrics?.totalStories ??
    dashboard?.metrics?.storyCount ??
    0
  );
}

function getDashboardSourceGroups(dashboard) {
  return Number(
    dashboard?.latest?.sourceGroups ??
    dashboard?.latest?.sourceGroupCount ??
    dashboard?.sourceGroups ??
    dashboard?.sourceGroupCount ??
    dashboard?.summary?.sourceGroups ??
    dashboard?.summary?.sourceGroupCount ??
    dashboard?.metrics?.sourceGroups ??
    dashboard?.metrics?.sourceGroupCount ??
    0
  );
}

function mergeDiagnostics(...diagnosticSets) {
  return diagnosticSets.flat().filter(Boolean);
}

export async function load() {
  const [dashboardEnv, reportEnv] = await Promise.all([
    fetchJson(publicDataUrl('newsdata/quality_dashboard.json'), {
      datasetId: 'qualityDashboard',
      source: ENVELOPE_SOURCES.SNAPSHOT,
    }),
    fetchJson(publicDataUrl('newsdata/insight_quality_report.json'), {
      datasetId: 'insightQualityReport',
      source: ENVELOPE_SOURCES.SNAPSHOT,
    }),
  ]);

  const dashboard = dashboardEnv.data;
  const report = reportEnv.data;

  const reportStoryCount = getStoryCountFromReport(report);
  const reportSourceGroupCount = getSourceGroupCountFromReport(report);
  const dashboardTotalStories = getDashboardTotalStories(dashboard);
  const dashboardSourceGroups = getDashboardSourceGroups(dashboard);

  const errors = [];

  if (!dashboardEnv.ok) {
    errors.push(dashboardEnv.error || 'quality_dashboard_unavailable');
  }

  if (!reportEnv.ok) {
    errors.push(reportEnv.error || 'insight_quality_report_unavailable');
  }

  const inconsistent =
    reportStoryCount > 0 &&
    dashboardTotalStories === 0;

  if (inconsistent) {
    errors.push('quality_dashboard_inconsistent');
  }

  const ok = errors.length === 0;

  const diagnostics = mergeDiagnostics(
    dashboardEnv.diagnostics,
    reportEnv.diagnostics,
    inconsistent
      ? [
          {
            event: 'quality_dashboard_inconsistent',
            severity: 'error',
            message: 'quality_dashboard latest.totalStories is zero while insight_quality_report story count is positive',
            details: {
              reportStoryCount,
              reportSourceGroupCount,
              dashboardTotalStories,
              dashboardSourceGroups,
            },
          },
        ]
      : []
  );

  return makeEnvelope({
    ok,
    datasetId: 'qualityDashboard',
    data: {
      dashboard,
      report,
      metrics: {
        reportStoryCount,
        reportSourceGroupCount,
        dashboardTotalStories,
        dashboardSourceGroups,
      },
    },
    source: ENVELOPE_SOURCES.SNAPSHOT,
    freshness: ok ? ENVELOPE_FRESHNESS.FRESH : ENVELOPE_FRESHNESS.UNKNOWN,
    error: ok ? null : errors.join('; '),
    validation: {
      passed: ok,
      errors,
      warnings: [],
    },
    diagnostics,
  });
}

export const __qualityDashboardInternalsForTest = {
  getStoryCountFromReport,
  getSourceGroupCountFromReport,
  getDashboardTotalStories,
  getDashboardSourceGroups,
};

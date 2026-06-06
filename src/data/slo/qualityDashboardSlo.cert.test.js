import { describe, expect, it } from 'vitest';
import { evaluateQualityDashboardSlo } from './qualityDashboardSlo.js';

describe('evaluateQualityDashboardSlo', () => {
  it('passes when report and dashboard are both nonzero and consistent', () => {
    const result = evaluateQualityDashboardSlo({
      reportStoryCount: 250,
      dashboardTotalStories: 250,
      reportSourceGroupCount: 10,
      dashboardSourceGroups: 10,
    });
    expect(result.passed).toBe(true);
    expect(result.reasons).toHaveLength(0);
    expect(result.required).toBe(true);
  });

  it('fails with dashboard_inconsistent_with_insight_report when report nonzero but dashboard zero', () => {
    const result = evaluateQualityDashboardSlo({
      reportStoryCount: 300,
      dashboardTotalStories: 0,
      reportSourceGroupCount: 10,
      dashboardSourceGroups: 0,
    });
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('dashboard_inconsistent_with_insight_report');
    expect(result.score).toBeLessThan(100);
  });

  it('passes when both report and dashboard are zero', () => {
    const result = evaluateQualityDashboardSlo({
      reportStoryCount: 0,
      dashboardTotalStories: 0,
    });
    expect(result.passed).toBe(true);
    expect(result.warnings).toContain('quality_data_empty');
  });

  it('warns (does not fail) when source groups are zero while report has source groups', () => {
    const result = evaluateQualityDashboardSlo({
      reportStoryCount: 100,
      dashboardTotalStories: 100,
      reportSourceGroupCount: 8,
      dashboardSourceGroups: 0,
    });
    expect(result.passed).toBe(true);
    expect(result.warnings).toContain('dashboard_source_groups_missing');
  });

  it('handles null/undefined metrics gracefully', () => {
    const result = evaluateQualityDashboardSlo(null);
    expect(result.passed).toBe(true);
    expect(result.warnings).toContain('quality_data_empty');
  });

  it('exposes metrics', () => {
    const result = evaluateQualityDashboardSlo({
      reportStoryCount: 100,
      dashboardTotalStories: 100,
      reportSourceGroupCount: 5,
      dashboardSourceGroups: 5,
    });
    expect(result.metrics.reportStoryCount).toBe(100);
    expect(result.metrics.dashboardTotalStories).toBe(100);
  });
});

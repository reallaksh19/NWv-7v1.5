import { beforeEach, describe, expect, it, vi } from 'vitest';
import { load, __qualityDashboardInternalsForTest } from './qualityDashboardDataset.js';

const { getStoryCountFromReport, getDashboardTotalStories } = __qualityDashboardInternalsForTest;

const DASHBOARD_OK = {
  latest: { totalStories: 250, sourceGroups: 12 },
};

const REPORT_OK = {
  storyCount: 250,
  sourceGroupCount: 12,
};

function makeFetch(dashboardData, reportData, opts = {}) {
  return vi.fn(async (url) => {
    if (url.includes('quality_dashboard')) {
      if (opts.dashboardFail) {
        return {
          ok: false,
          status: 404,
          json: async () => ({}),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ generatedAt: Date.now(), ...dashboardData }),
      };
    }

    if (url.includes('insight_quality_report')) {
      if (opts.reportFail) {
        return {
          ok: false,
          status: 404,
          json: async () => ({}),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ generatedAt: Date.now(), ...reportData }),
      };
    }

    return { ok: false, status: 404, json: async () => ({}) };
  });
}

describe('qualityDashboardDataset', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns frozen envelope with correct datasetId', async () => {
    vi.stubGlobal('fetch', makeFetch(DASHBOARD_OK, REPORT_OK));
    const env = await load();
    expect(Object.isFrozen(env)).toBe(true);
    expect(env.datasetId).toBe('qualityDashboard');
  });

  it('ok:true when dashboard and report are consistent', async () => {
    vi.stubGlobal('fetch', makeFetch(DASHBOARD_OK, REPORT_OK));
    const env = await load();
    expect(env.ok).toBe(true);
    expect(env.validation.passed).toBe(true);
    expect(env.validation.errors).toHaveLength(0);
  });

  it('ok:false with quality_dashboard_inconsistent error when report has stories but dashboard has zero', async () => {
    vi.stubGlobal('fetch', makeFetch(
      { latest: { totalStories: 0, sourceGroups: 0 } },
      { storyCount: 300, sourceGroupCount: 10 },
    ));
    const env = await load();
    expect(env.ok).toBe(false);
    expect(env.validation.errors).toContain('quality_dashboard_inconsistent');
  });

  it('ok:true when both report and dashboard are zero (not inconsistent)', async () => {
    vi.stubGlobal('fetch', makeFetch(
      { latest: { totalStories: 0 } },
      { storyCount: 0 },
    ));
    const env = await load();
    expect(env.ok).toBe(true);
    expect(env.validation.errors).toHaveLength(0);
  });

  it('ok:false when dashboard fetch fails', async () => {
    vi.stubGlobal('fetch', makeFetch(null, REPORT_OK, { dashboardFail: true }));
    const env = await load();
    expect(env.ok).toBe(false);
    expect(env.validation.errors.length).toBeGreaterThan(0);
  });

  it('ok:false when report fetch fails', async () => {
    vi.stubGlobal('fetch', makeFetch(DASHBOARD_OK, null, { reportFail: true }));
    const env = await load();
    expect(env.ok).toBe(false);
    expect(env.validation.errors.length).toBeGreaterThan(0);
  });

  it('exposes metrics on env.data', async () => {
    vi.stubGlobal('fetch', makeFetch(DASHBOARD_OK, REPORT_OK));
    const env = await load();
    expect(env.data.metrics.reportStoryCount).toBe(250);
    expect(env.data.metrics.dashboardTotalStories).toBe(250);
  });

  it('getStoryCountFromReport reads multiple field paths', () => {
    expect(getStoryCountFromReport({ storyCount: 10 })).toBe(10);
    expect(getStoryCountFromReport({ stories: 20 })).toBe(20);
    expect(getStoryCountFromReport({ latest: { storyCount: 30 } })).toBe(30);
    expect(getStoryCountFromReport(null)).toBe(0);
  });

  it('getDashboardTotalStories reads multiple field paths', () => {
    expect(getDashboardTotalStories({ latest: { totalStories: 100 } })).toBe(100);
    expect(getDashboardTotalStories({ totalStories: 50 })).toBe(50);
    expect(getDashboardTotalStories(null)).toBe(0);
  });
});

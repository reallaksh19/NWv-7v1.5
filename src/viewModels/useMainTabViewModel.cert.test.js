import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import {
  __mainViewModelInternalsForTest,
} from './useMainTabViewModel.js';

const {
  MIN_CUSTOM_TOP_STORIES,
  MAX_VIEW_COUNT_FOR_CUSTOM_TOP_STORIES,
  asArray,
  asRecord,
  filterLatestStories,
  getNavSections,
  getProjectedMainData,
  makeMainBoundaryEnvelope,
  getRefreshOutcome,
  getFirstNewsError,
} = __mainViewModelInternalsForTest;

describe('useMainTabViewModel static checks', () => {
  const src = fs.readFileSync('src/viewModels/useMainTabViewModel.js', 'utf8');

  it('uses main dataset and owns context orchestration', () => {
    expect(src).toContain("useDataset('main')");
    expect(src).toContain('useWeather');
    expect(src).toContain('useNews');
    expect(src).toContain('useSettings');
    expect(src).toContain('useSegment');
  });

  it('owns travel, topline, latest-story, and audit projection', () => {
    expect(src).toContain('getTravelLocationProfile');
    expect(src).toContain('fetchTravelNewsPayload');
    expect(src).toContain('mergeTravelNewsIntoNewsData');
    expect(src).toContain('applyTravelLocationPriority');
    expect(src).toContain('generateTopline');
    expect(src).toContain('fetchOnThisDay');
    expect(src).toContain('filterLatestStories');
    expect(src).toContain('auditMainTabQuality');
  });

  it('supports both mainDataset shapes', () => {
    expect(src).toContain('data.newsData');
    expect(src).toContain('data.frontPage');
    expect(src).toContain('data.quickWeather');
    expect(src).toContain('data.raw?.newsData');
  });

  it('uses safe refresh fan-out and never passes boolean to refreshNews', () => {
    expect(src).toContain('Promise.allSettled');
    expect(src).toContain('refreshWeather(true)');
    expect(src).toContain('refreshNews()');
    expect(src).not.toContain('refreshNews' + '(true)');
  });

  it('guards Notification access', () => {
    expect(src).toContain("typeof Notification === 'undefined'");
  });

  it('applies travel priority to Top Stories when enabled', () => {
    expect(src).toContain('travelLocationProfile?.prioritizeStories');
    expect(src).toContain('prioritizedNewsData.frontPage');
  });
});

describe('Main ViewModel internals', () => {
  it('defines custom top-story constants', () => {
    expect(MIN_CUSTOM_TOP_STORIES).toBe(10);
    expect(MAX_VIEW_COUNT_FOR_CUSTOM_TOP_STORIES).toBe(3);
  });

  it('normalizes arrays and records', () => {
    expect(asArray(null)).toEqual([]);
    expect(asArray([1])).toEqual([1]);
    expect(asRecord(null)).toEqual({});
    expect(asRecord({ a: 1 })).toEqual({ a: 1 });
  });

  it('returns standard front-page stories when custom sort is disabled', () => {
    const stories = [
      { id: 'a', impactScore: 1 },
      { id: 'b', impactScore: 5 },
    ];

    expect(filterLatestStories(stories, false)).toBe(stories);
  });

  it('sorts custom latest stories by impact score and preserves fallback minimum', () => {
    const stories = Array.from({ length: 12 }).map((_, index) => ({
      id: `story-${index}`,
      impactScore: index,
    }));

    const result = filterLatestStories(stories, true);

    expect(result).toHaveLength(12);
    expect(result[0].impactScore).toBe(11);
  });

  it('builds navigation sections from enabled settings', () => {
    const result = getNavSections({
      india: { enabled: true },
      chennai: { enabled: false },
      local: { enabled: true },
    });

    expect(result.map(item => item.id)).toEqual([
      'top-stories',
      'india-news',
      'local-news',
      'world-news',
    ]);
  });

  it('prefers dataset newsData shape when available', () => {
    const result = getProjectedMainData({
      envelope: {
        data: {
          newsData: {
            frontPage: [{ title: 'Dataset newsData' }],
          },
          weatherData: {
            chennai: { temp: 30 },
          },
          breakingNews: [{ title: 'Breaking dataset' }],
        },
      },
      newsData: {
        frontPage: [{ title: 'Context' }],
      },
      weatherData: {
        chennai: { temp: 20 },
      },
      breakingNews: [{ title: 'Breaking context' }],
    });

    expect(result.newsData.frontPage[0].title).toBe('Dataset newsData');
    expect(result.weatherData.chennai.temp).toBe(30);
    expect(result.breakingNews[0].title).toBe('Breaking dataset');
  });

  it('accepts mainDataset frontPage/sections shape', () => {
    const result = getProjectedMainData({
      envelope: {
        data: {
          frontPage: [{ title: 'Dataset frontPage' }],
          sections: {
            world: [{ title: 'World dataset' }],
            india: [{ title: 'India dataset' }],
          },
          quickWeather: {
            chennai: { temp: 31 },
          },
        },
      },
      newsData: {
        frontPage: [{ title: 'Context frontPage' }],
        world: [{ title: 'World context' }],
        india: [{ title: 'India context' }],
        chennai: [{ title: 'Chennai context' }],
        local: [{ title: 'Local context' }],
      },
      weatherData: {
        chennai: { temp: 20 },
      },
      breakingNews: [],
    });

    expect(result.newsData.frontPage[0].title).toBe('Dataset frontPage');
    expect(result.newsData.world[0].title).toBe('World dataset');
    expect(result.newsData.india[0].title).toBe('India dataset');
    expect(result.newsData.chennai[0].title).toBe('Chennai context');
    expect(result.weatherData.chennai.temp).toBe(31);
  });

  it('falls back to raw news data when present', () => {
    const result = getProjectedMainData({
      envelope: {
        data: {
          raw: {
            newsData: {
              frontPage: [{ title: 'Raw news' }],
            },
          },
        },
      },
      newsData: {
        frontPage: [{ title: 'Context' }],
      },
      weatherData: null,
      breakingNews: [],
    });

    expect(result.newsData.frontPage[0].title).toBe('Raw news');
  });

  it('falls back to context data when dataset is empty', () => {
    const result = getProjectedMainData({
      envelope: {
        data: {},
      },
      newsData: {
        frontPage: [{ title: 'Context' }],
      },
      weatherData: {
        chennai: { temp: 20 },
      },
      breakingNews: [{ title: 'Breaking context' }],
    });

    expect(result.newsData.frontPage[0].title).toBe('Context');
    expect(result.weatherData.chennai.temp).toBe(20);
    expect(result.breakingNews[0].title).toBe('Breaking context');
  });

  it('uses topline breakingNews fallback', () => {
    const result = getProjectedMainData({
      envelope: {
        data: {
          topline: {
            breakingNews: [{ title: 'Topline breaking' }],
          },
        },
      },
      newsData: {},
      weatherData: null,
      breakingNews: [{ title: 'Context breaking' }],
    });

    expect(result.breakingNews[0].title).toBe('Topline breaking');
  });

  it('builds a renderable boundary envelope', () => {
    const result = makeMainBoundaryEnvelope({
      envelope: null,
      newsData: {
        frontPage: [{ title: 'A' }],
      },
      weatherData: null,
      breakingNews: [],
      isLoading: false,
      error: null,
    });

    expect(result.ok).toBe(true);
    expect(result.datasetId).toBe('main');
    expect(result.data.projectedHasRenderableMain).toBe(true);
  });

  it('does not mark loading-only empty fallback envelope as ok', () => {
    const result = makeMainBoundaryEnvelope({
      envelope: null,
      newsData: {},
      weatherData: null,
      breakingNews: [],
      isLoading: true,
      error: null,
    });

    expect(result.ok).toBe(false);
    expect(result.validation.passed).toBe(false);
    expect(result.validation.warnings).toContain('main_loading_without_renderable_projection');
  });

  it('does not mark loading-only empty existing envelope as ok', () => {
    const result = makeMainBoundaryEnvelope({
      envelope: {
        ok: true,
        datasetId: 'main',
        data: {},
        validation: {
          passed: true,
          errors: [],
          warnings: [],
        },
      },
      newsData: {},
      weatherData: null,
      breakingNews: [],
      isLoading: true,
      error: null,
    });

    expect(result.ok).toBe(false);
    expect(result.validation.passed).toBe(false);
    expect(result.validation.warnings).toContain('main_loading_without_renderable_projection');
  });

  it('returns degraded success when one refresh branch fails and one succeeds', () => {
    const result = getRefreshOutcome([
      {
        status: 'fulfilled',
        value: { ok: false, error: 'Dataset degraded' },
      },
      {
        status: 'fulfilled',
        value: { ok: true },
      },
      {
        status: 'fulfilled',
        value: undefined,
      },
    ]);

    expect(result.ok).toBe(true);
    expect(result.degraded).toBe(true);
  });

  it('detects rejected refresh outcome when no branch succeeds', () => {
    const result = getRefreshOutcome([
      {
        status: 'rejected',
        reason: new Error('Network failed'),
      },
    ]);

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Network failed');
  });

  it('accepts all-fulfilled refresh outcome', () => {
    const result = getRefreshOutcome([
      {
        status: 'fulfilled',
        value: undefined,
      },
      {
        status: 'fulfilled',
        value: { ok: true },
      },
    ]);

    expect(result.ok).toBe(true);
  });

  it('normalizes news errors', () => {
    expect(getFirstNewsError(['A'])).toBe('A');
    expect(getFirstNewsError('B')).toBe('B');
    expect(getFirstNewsError({ message: 'C' })).toBe('C');
    expect(getFirstNewsError(null)).toBe(null);
  });

  it('always includes world in nav sections', () => {
    const result = getNavSections({
      india: { enabled: true },
      chennai: { enabled: false },
      local: { enabled: true },
    });

    expect(result.map(item => item.id)).toEqual([
      'top-stories',
      'india-news',
      'local-news',
      'world-news',
    ]);
  });

  it('emits main_no_renderable_data warning when data absent and not loading', () => {
    const result = makeMainBoundaryEnvelope({
      envelope: null,
      newsData: {},
      weatherData: null,
      breakingNews: [],
      isLoading: false,
      error: null,
    });

    expect(result.ok).toBe(false);
    expect(result.validation.warnings).toContain('main_no_renderable_data');
    expect(result.validation.warnings).not.toContain('main_loading_without_renderable_projection');
  });
});


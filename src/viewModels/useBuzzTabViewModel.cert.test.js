import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import {
  __buzzViewModelInternalsForTest,
} from './useBuzzTabViewModel.js';

const {
  getTimestamp,
  filterOldNews,
  normalizeEntertainment,
  flattenSocialTrends,
} = __buzzViewModelInternalsForTest;

describe('useBuzzTabViewModel static migration checks', () => {
  const src = fs.readFileSync('src/viewModels/useBuzzTabViewModel.js', 'utf8');

  it('uses buzz dataset and not NewsContext', () => {
    expect(src).toContain("useDataset('buzz')");
    expect(src).not.toContain('useNews');
    expect(src).not.toContain('NewsContext');
    expect(src).not.toContain('refreshNews');
    expect(src).not.toContain('loadSection');
  });

  it('does not use localStorage cache', () => {
    expect(src).not.toContain('localStorage');
    expect(src).not.toContain('CACHE_KEY');
  });

  it('projects Buzz Hub page state', () => {
    expect(src).toContain('entertainmentByRegion');
    expect(src).toContain('socialTrends');
    expect(src).toContain('techCards');
    expect(src).toContain('aiCards');
    expect(src).toContain('navSections');
  });

  it('preserves freshness and social distribution logic in ViewModel', () => {
    expect(src).toContain('filterOldNews');
    expect(src).toContain('freshnessLimitHours');
    expect(src).toContain('getSocialDistribution');
    expect(src).toContain('SOCIAL_REGION_LABELS');
  });

  it('exposes reload through dataset reload', () => {
    expect(src).toContain('reloadDataset(force)');
    expect(src).toContain('return reloadDataset(force)');
  });
});

describe('Buzz ViewModel internals', () => {
  it('parses ISO timestamps', () => {
    const ts = getTimestamp({ publishedAt: '2026-05-28T10:00:00Z' });
    expect(ts).toBeGreaterThan(0);
  });

  it('normalizes seconds timestamps to milliseconds', () => {
    const ts = getTimestamp({ publishedAt: 1716880800 });
    expect(ts).toBeGreaterThan(1_000_000_000_000);
  });

  it('passes millisecond timestamps through', () => {
    const ts = getTimestamp({ publishedAt: 1716880800000 });
    expect(ts).toBe(1716880800000);
  });

  it('filters old articles by freshness window', () => {
    const now = Date.UTC(2026, 4, 28, 12, 0, 0);

    const items = [
      { title: 'fresh', publishedAt: now - 2 * 60 * 60 * 1000 },
      { title: 'old', publishedAt: now - 90 * 60 * 60 * 1000 },
    ];

    const result = filterOldNews(items, 72, now);

    expect(result.map(item => item.title)).toEqual(['fresh']);
  });

  it('keeps untimestamped articles because freshness cannot be evaluated', () => {
    const result = filterOldNews([{ title: 'unknown-date' }], 72, Date.now());
    expect(result.map(item => item.title)).toEqual(['unknown-date']);
  });

  it('adds entertainment region fallback', () => {
    const result = normalizeEntertainment({
      tamil: [{ title: 'Tamil film' }],
    }, 72);

    expect(result.tamil[0].region).toBe('tamil');
  });

  it('flattens social trends using configured counts', () => {
    const now = Date.UTC(2026, 4, 28, 12, 0, 0);

    const result = flattenSocialTrends({
      world: [
        { title: 'W1', publishedAt: now },
        { title: 'W2', publishedAt: now - 1000 },
      ],
      india: [
        { title: 'I1', publishedAt: now },
      ],
    }, {
      socialTrends: {
        worldCount: 1,
        indiaCount: 1,
      },
    }, 72, now);

    expect(result).toHaveLength(2);
    expect(result.some(item => item.region === 'world')).toBe(true);
    expect(result.some(item => item.region === 'india')).toBe(true);
  });
});

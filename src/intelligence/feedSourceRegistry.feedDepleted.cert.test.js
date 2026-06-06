import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recordFeedResult } from './feedHealthMonitor.js';
import { buildFeedFetchPlan } from './feedSourceRegistry.js';

function makeStorage() {
  const store = new Map();

  return {
    getItem: vi.fn(key => store.get(key) ?? null),
    setItem: vi.fn((key, value) => {
      store.set(key, String(value));
    }),
  };
}

describe('feed source registry depleted-plan certification', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-30T08:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('returns an empty plan when all sources for a category are demoted', () => {
    vi.stubGlobal('localStorage', makeStorage());

    const registry = {
      alerts: {
        Chennai: [
          { url: 'https://example.com/a.rss', sourceType: 'general_news', trust: 'high' },
          { url: 'https://example.com/b.rss', sourceType: 'search', trust: 'high' },
        ],
      },
    };

    for (const source of registry.alerts.Chennai) {
      recordFeedResult(source.url, false);
      recordFeedResult(source.url, false);
      recordFeedResult(source.url, false);
    }

    const plan = buildFeedFetchPlan({
      categories: ['alerts'],
      locations: ['Chennai'],
      registry,
      isStaticHost: true,
    });

    expect(plan).toEqual([]);
  });
});

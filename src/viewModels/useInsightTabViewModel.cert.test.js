import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import {
  __insightViewModelInternalsForTest,
} from './useInsightTabViewModel.js';

const {
  CACHE_KEY,
  CACHE_SCHEMA_VERSION,
  REFRESH_EVERY,
  HIDDEN_REFRESH,
  normalizeStoriesById,
  serializeInsightResult,
  extractInsightResultFromEnvelope,
  getInsightResultParentCount,
  hasRenderableInsightResult,
  hasQualityAcceptedInsightResult,
  hasCacheAcceptableInsightResult,
  getInsightResultSignature,
  hasMeaningfulInsightChange,
  getInsightEmptyStateMessage,
  getInsightSourceLabel,
  formatInsightAge,
  getInsightStaleLabel,
  makeInsightBoundaryEnvelope,
  getRefreshOutcome,
} = __insightViewModelInternalsForTest;

describe('useInsightTabViewModel static checks', () => {
  const src = fs.readFileSync('src/viewModels/useInsightTabViewModel.js', 'utf8');

  it('uses insight dataset and owns pipeline orchestration', () => {
    expect(src).toContain("useDataset('insight')");
    expect(src).toContain('runInsightPipeline');
    expect(src).toContain('createInsightFetcher');
    expect(src).toContain('recoverInsightRuntimeQuality');
    expect(src).toContain('repairInsightResult');
  });

  it('owns cache, pending result, interval, and visibility refresh', () => {
    expect(src).toContain('readInsightCache');
    expect(src).toContain('writeInsightCache');
    expect(src).toContain('pendingResult');
    expect(src).toContain('setInterval');
    expect(src).toContain('visibilitychange');
  });

  it('waits for dataset loading before local pipeline fallback', () => {
    expect(src).toContain('bootstrapStartedRef');
    expect(src).toContain('if (datasetLoading)');
  });

  it('guards browser and mounted state', () => {
    expect(src).toContain('useMountedRef');
    expect(src).toContain("typeof document === 'undefined'");
    expect(src).toContain("typeof window === 'undefined'");
  });

  it('distinguishes renderable from quality accepted and cache acceptable', () => {
    expect(src).toContain('hasRenderableInsightResult');
    expect(src).toContain('hasQualityAcceptedInsightResult');
    expect(src).toContain('hasCacheAcceptableInsightResult');
  });

  it('uses meaningful result signatures for fresh result detection', () => {
    expect(src).toContain('getInsightResultSignature');
    expect(src).toContain('hasMeaningfulInsightChange');
  });

  it('supports degraded refresh outcome and explicit pipeline refresh', () => {
    expect(src).toContain('getRefreshOutcome');
    expect(src).toContain('forcePipeline');
  });
});

describe('Insight ViewModel internals', () => {
  it('defines cache and refresh constants', () => {
    expect(CACHE_KEY).toBe('insight_pipeline_cache');
    expect(CACHE_SCHEMA_VERSION).toBeTruthy();
    expect(REFRESH_EVERY).toBe(5 * 60_000);
    expect(HIDDEN_REFRESH).toBe(5 * 60_000);
  });

  it('normalizes storiesById from object to Map', () => {
    const result = normalizeStoriesById({
      a: { title: 'A' },
    });

    expect(result instanceof Map).toBe(true);
    expect(result.get('a').title).toBe('A');
  });

  it('serializes Map storiesById to object', () => {
    const result = serializeInsightResult({
      parents: [],
      storiesById: new Map([['a', { title: 'A' }]]),
    });

    expect(result.storiesById.a.title).toBe('A');
  });

  it('extracts insight result from dataset envelope result field', () => {
    const result = extractInsightResultFromEnvelope({
      data: {
        result: {
          parents: [{ parentId: 'p1' }],
          storiesById: {},
        },
      },
    });

    expect(result.parents).toHaveLength(1);
    expect(result.storiesById instanceof Map).toBe(true);
  });

  it('counts result parents safely', () => {
    expect(getInsightResultParentCount({ parents: [1, 2] })).toBe(2);
    expect(getInsightResultParentCount({})).toBe(0);
  });

  it('does not treat zero-parent dataset result as renderable', () => {
    expect(hasRenderableInsightResult({ parents: [] })).toBe(false);
  });

  it('treats parent-bearing result as renderable', () => {
    expect(hasRenderableInsightResult({ parents: [{ parentId: 'p1' }] })).toBe(true);
  });

  it('does not cache runtime-quality rejected result', () => {
    const weak = {
      parents: [{ parentId: 'p1' }],
      runtimeQualityGate: {
        attempted: true,
        recovered: false,
      },
    };

    expect(hasQualityAcceptedInsightResult(weak)).toBe(false);
    expect(hasCacheAcceptableInsightResult(weak)).toBe(false);
  });

  it('treats accepted first-pass result as cacheable', () => {
    const good = {
      parents: [{ parentId: 'p1' }],
      runtimeQualityGate: {
        attempted: false,
        recovered: false,
      },
    };

    expect(hasQualityAcceptedInsightResult(good)).toBe(true);
    expect(hasCacheAcceptableInsightResult(good)).toBe(true);
  });

  it('detects meaningful insight change even when parent count is unchanged', () => {
    const a = {
      parents: [
        {
          parentId: 'p1',
          canonicalHeadline: 'A',
          finalParentScore: 0.5,
          childStoryIds: ['a', 'b'],
          clusterStoryIds: ['a', 'b', 'c'],
        },
      ],
    };

    const b = {
      parents: [
        {
          parentId: 'p1',
          canonicalHeadline: 'A updated',
          finalParentScore: 0.7,
          childStoryIds: ['a', 'b', 'd'],
          clusterStoryIds: ['a', 'b', 'd'],
        },
      ],
    };

    expect(getInsightResultSignature(a)).not.toBe(getInsightResultSignature(b));
    expect(hasMeaningfulInsightChange(a, b)).toBe(true);
  });

  it('builds empty state messages from runtime quality reason', () => {
    expect(getInsightEmptyStateMessage({
      runtimeQualityGate: {
        reason: 'Low quality',
      },
    }, 'live')).toBe('Low quality');
  });

  it('labels insight sources', () => {
    expect(getInsightSourceLabel('stale-snapshot')).toBe('Stale snapshot');
    expect(getInsightSourceLabel('snapshot')).toBe('Snapshot');
    expect(getInsightSourceLabel('cached')).toBe('Cached');
    expect(getInsightSourceLabel('dataset')).toBe('Dataset');
    expect(getInsightSourceLabel('live')).toBe('Live');
  });

  it('formats age labels', () => {
    const now = Date.now();
    expect(formatInsightAge(now - 2 * 60 * 60 * 1000)).toBe('2h ago');
  });

  it('keeps stale snapshot label as pre-generated, not cached', () => {
    const label = getInsightStaleLabel({
      source: 'stale-snapshot',
      fetcherSnapshotTs: Date.now(),
      envelope: null,
    });

    expect(label).toContain('Pre-generated ·');
  });

  it('marks zero-parent boundary envelope as not ok', () => {
    const result = makeInsightBoundaryEnvelope({
      envelope: null,
      result: {
        parents: [],
        storiesById: new Map(),
      },
      source: 'pipeline',
      emptyReason: 'No renderable Insight clusters',
    });

    expect(result.ok).toBe(false);
    expect(result.validation.passed).toBe(false);
    expect(result.data.projectedHasRenderableInsight).toBe(false);
  });

  it('returns successful degraded refresh when pipeline succeeds after dataset failure', () => {
    const outcome = getRefreshOutcome([
      {
        status: 'fulfilled',
        value: { ok: false, error: 'Dataset failed' },
      },
      {
        status: 'fulfilled',
        value: {
          ok: true,
          degraded: true,
          result: { parents: [{ parentId: 'p1' }] },
        },
      },
    ]);

    expect(outcome.ok).toBe(true);
    expect(outcome.degraded).toBe(true);
  });
});

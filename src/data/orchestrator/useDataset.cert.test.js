// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  loadDataset,
  useDataset,
  listDatasetCache,
  __clearDatasetCacheForTest,
  __getDatasetCacheForTest,
} from './useDataset.js';
import * as datasetsIndex from '../datasets/index.js';

const MOCK_ENVELOPE = Object.freeze({
  ok: true,
  datasetId: 'market',
  data: { indices: [{ name: 'TEST', value: 1 }] },
  payloadHash: 'abcdef01',
  source: 'live',
  freshness: 'fresh',
  generatedAt: Date.now(),
  fetchedAt: Date.now(),
  lastGoodAt: null,
  schemaVersion: '1',
  fallbackUsed: false,
  validation: { passed: true, errors: [], warnings: [] },
  slo: { passed: true, score: 100, reasons: [] },
  diagnostics: [],
  error: null,
});

function mockLoader(envelope = MOCK_ENVELOPE, delay = 0) {
  return {
    load: vi.fn(async () => {
      if (delay > 0) {
        await new Promise(r => setTimeout(r, delay));
      }
      return envelope;
    }),
  };
}

describe('loadDataset', () => {
  beforeEach(() => {
    __clearDatasetCacheForTest();
    vi.restoreAllMocks();
  });

  it('throws for unknown dataset id', async () => {
    vi.spyOn(datasetsIndex, 'getDatasetLoader').mockReturnValue(null);
    await expect(loadDataset('unknown-id')).rejects.toThrow('Unknown dataset');
  });

  it('returns envelope and caches it', async () => {
    const loader = mockLoader();
    vi.spyOn(datasetsIndex, 'getDatasetLoader').mockReturnValue(loader);

    const env = await loadDataset('market');
    expect(env).toBe(MOCK_ENVELOPE);
    expect(loader.load).toHaveBeenCalledTimes(1);

    const cachedEnv = await loadDataset('market');
    expect(cachedEnv).toBe(MOCK_ENVELOPE);
    expect(loader.load).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent calls — load is called exactly once', async () => {
    const loader = mockLoader(MOCK_ENVELOPE, 20);
    vi.spyOn(datasetsIndex, 'getDatasetLoader').mockReturnValue(loader);

    const [a, b, c] = await Promise.all([
      loadDataset('market'),
      loadDataset('market'),
      loadDataset('market'),
    ]);

    expect(loader.load).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('force=true bypasses the cache', async () => {
    const loader = mockLoader();
    vi.spyOn(datasetsIndex, 'getDatasetLoader').mockReturnValue(loader);

    await loadDataset('market');
    await loadDataset('market', true);

    expect(loader.load).toHaveBeenCalledTimes(2);
  });

  it('caches the result in the module-level cache map', async () => {
    const loader = mockLoader();
    vi.spyOn(datasetsIndex, 'getDatasetLoader').mockReturnValue(loader);

    await loadDataset('market');

    const cache = __getDatasetCacheForTest();
    expect(cache.has('market')).toBe(true);
  });
});

describe('listDatasetCache', () => {
  beforeEach(() => {
    __clearDatasetCacheForTest();
    vi.restoreAllMocks();
  });

  it('returns empty array when cache is empty', () => {
    expect(listDatasetCache()).toHaveLength(0);
  });

  it('returns entries after load', async () => {
    const loader = mockLoader();
    vi.spyOn(datasetsIndex, 'getDatasetLoader').mockReturnValue(loader);

    await loadDataset('market');
    const entries = listDatasetCache();
    expect(entries).toHaveLength(1);
    expect(entries[0].datasetId).toBe('market');
    expect(entries[0].envelope).toBe(MOCK_ENVELOPE);
  });
});

describe('useDataset hook', () => {
  beforeEach(() => {
    __clearDatasetCacheForTest();
    vi.restoreAllMocks();
  });

  it('starts loading and transitions to loaded state', async () => {
    const loader = mockLoader();
    vi.spyOn(datasetsIndex, 'getDatasetLoader').mockReturnValue(loader);

    const { result } = renderHook(() => useDataset('market'));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.envelope).toBe(MOCK_ENVELOPE);
    expect(result.current.error).toBeNull();
  });

  it('sets error when envelope.ok is false', async () => {
    const failedEnvelope = Object.freeze({
      ...MOCK_ENVELOPE,
      ok: false,
      error: 'data unavailable',
    });
    const loader = mockLoader(failedEnvelope);
    vi.spyOn(datasetsIndex, 'getDatasetLoader').mockReturnValue(loader);

    const { result } = renderHook(() => useDataset('market'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('data unavailable');
  });

  it('reload() re-fetches and updates state', async () => {
    const loader = mockLoader();
    vi.spyOn(datasetsIndex, 'getDatasetLoader').mockReturnValue(loader);

    const { result } = renderHook(() => useDataset('market'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.reload();
    });

    expect(loader.load).toHaveBeenCalledTimes(2);
    expect(result.current.envelope).toBe(MOCK_ENVELOPE);
  });

  it('auto:false does not trigger initial load', () => {
    const loader = mockLoader();
    vi.spyOn(datasetsIndex, 'getDatasetLoader').mockReturnValue(loader);

    const { result } = renderHook(() => useDataset('market', { auto: false }));

    expect(result.current.loading).toBe(false);
    expect(loader.load).not.toHaveBeenCalled();
  });

  it('uses cached envelope as initial state when available (auto:false)', async () => {
    const loader = mockLoader();
    vi.spyOn(datasetsIndex, 'getDatasetLoader').mockReturnValue(loader);

    await loadDataset('market');

    // auto:false prevents the effect from re-triggering, so we can assert initial cache state cleanly
    const { result } = renderHook(() => useDataset('market', { auto: false }));

    expect(result.current.envelope).toBe(MOCK_ENVELOPE);
    expect(result.current.loading).toBe(false);
  });
});

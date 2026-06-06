import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchJson, publicDataUrl } from './fetchClient.js';

describe('fetchClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('publicDataUrl strips leading slash', () => {
    expect(publicDataUrl('/newsdata/test.json')).toContain('newsdata/test.json');
    expect(publicDataUrl('newsdata/test.json')).toContain('newsdata/test.json');
  });

  it('fetchJson returns ok:true envelope for 200 JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        generatedAt: Date.now(),
        value: 42,
      }),
    })));

    const env = await fetchJson('/mock.json', {
      datasetId: 'mock',
    });

    expect(env.ok).toBe(true);
    expect(env.datasetId).toBe('mock');
    expect(env.data.value).toBe(42);
    expect(env.diagnostics[0].event).toBe('fetch_json_success');
  });

  it('fetchJson returns ok:false envelope for HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    })));

    const env = await fetchJson('/mock.json', {
      datasetId: 'mock',
    });

    expect(env.ok).toBe(false);
    expect(env.error).toBe('HTTP 500');
    expect(env.validation.passed).toBe(false);
  });

  it('fetchJson returns ok:false envelope for thrown fetch error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network down');
    }));

    const env = await fetchJson('/mock.json', {
      datasetId: 'mock',
    });

    expect(env.ok).toBe(false);
    expect(env.error).toContain('network down');
    expect(env.diagnostics[0].event).toBe('fetch_json_failed');
  });

  it('relays optional signal aborts into the active fetch', async () => {
    const controller = new AbortController();
    let fetchSignal;

    const fetchMock = vi.fn((_url, options = {}) => {
      fetchSignal = options.signal;

      return new Promise((_, reject) => {
        fetchSignal.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    const envPromise = fetchJson('/mock.json', {
      datasetId: 'mock',
      signal: controller.signal,
    });

    expect(fetchSignal).toBeInstanceOf(AbortSignal);

    controller.abort();
    const env = await envPromise;

    expect(fetchSignal.aborted).toBe(true);
    expect(env.ok).toBe(false);
  });

  it('aborts the underlying fetch when timeout expires', async () => {
    vi.useFakeTimers();

    try {
      let fetchSignal;

      vi.stubGlobal('fetch', vi.fn((_url, options = {}) => {
        fetchSignal = options.signal;

        return new Promise((_, reject) => {
          fetchSignal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      }));

      const envPromise = fetchJson('/slow.json', {
        datasetId: 'slow',
        timeoutMs: 10,
      });

      await vi.advanceTimersByTimeAsync(10);
      const env = await envPromise;

      expect(fetchSignal.aborted).toBe(true);
      expect(env.ok).toBe(false);
      expect(env.error).toBe('TimeoutError');
    } finally {
      vi.useRealTimers();
    }
  });
});

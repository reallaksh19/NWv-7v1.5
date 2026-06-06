import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchJsonDirectOrProxy } from './indianMarketStableService.js';

describe('market service proxy timeout certification', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('aborts each hanging Yahoo transport before trying the next proxy', async () => {
    const signals = [];

    vi.stubGlobal('fetch', vi.fn((_url, options = {}) => {
      if (options.signal) signals.push(options.signal);

      return new Promise((_, reject) => {
        options.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    }));

    const resultPromise = fetchJsonDirectOrProxy(
      'https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI',
      25
    );

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await vi.advanceTimersByTimeAsync(25);
      await Promise.resolve();
    }

    await expect(resultPromise).resolves.toBeNull();
    expect(signals).toHaveLength(4);
    expect(signals.every(signal => signal.aborted)).toBe(true);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchWeather } from './weatherService.js';

function makeStorage(seed = {}) {
  const store = new Map(Object.entries(seed));

  return {
    getItem: vi.fn(key => store.get(key) ?? null),
    setItem: vi.fn((key, value) => {
      store.set(key, String(value));
    }),
    removeItem: vi.fn(key => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
  };
}

describe('weather service network timeout certification', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-30T08:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('aborts hanging Open-Meteo model fetches and falls back to stale cache', async () => {
    const cachedWeather = {
      name: 'Chennai cached',
      fetchedAt: Date.now() - 5 * 60 * 60 * 1000,
      current: { temp: 31, condition: 'Cloudy' },
      hourly24: [{ time: 'Now', temp: 31, condition: 'Cloudy' }],
    };
    const storage = makeStorage({
      weather_cache_v2_chennai: JSON.stringify(cachedWeather),
    });
    const signals = [];

    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('fetch', vi.fn((_url, options = {}) => {
      if (options.signal) signals.push(options.signal);

      return new Promise((_, reject) => {
        options.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    }));

    const weatherPromise = fetchWeather('chennai');

    await vi.advanceTimersByTimeAsync(15000);
    const result = await weatherPromise;

    expect(result).toMatchObject({
      name: 'Chennai cached',
      isStale: true,
    });
    expect(signals).toHaveLength(3);
    expect(signals.every(signal => signal.aborted)).toBe(true);
  });
});

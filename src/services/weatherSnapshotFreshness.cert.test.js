import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWeather } from './weatherService.js';

function mockWeatherFetchWithSnapshot(snapshot) {
  vi.stubGlobal('fetch', vi.fn(async url => {
    const textUrl = String(url);

    if (textUrl.includes('weather_snapshot.json')) {
      return {
        ok: true,
        json: async () => snapshot,
      };
    }

    return {
      ok: false,
      status: 503,
      json: async () => ({}),
    };
  }));
}

describe('Weather snapshot freshness guard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects weather snapshots older than the displayable freshness limit', async () => {
    mockWeatherFetchWithSnapshot({
      chennai: {
        name: 'Chennai',
        sourceMode: 'snapshot',
        fetchedAt: Date.now() - 90 * 24 * 60 * 60 * 1000,
        current: {
          temp: 34,
          condition: 'Partly Cloudy',
        },
      },
    });

    await expect(fetchWeather('chennai')).rejects.toThrow(/weather/i);
  });

  it('keeps a fresh snapshot available when live models fail', async () => {
    mockWeatherFetchWithSnapshot({
      chennai: {
        name: 'Chennai',
        sourceMode: 'snapshot',
        fetchedAt: Date.now() - 60 * 60 * 1000,
        current: {
          temp: 31,
          condition: 'Cloudy',
        },
      },
    });

    await expect(fetchWeather('chennai')).resolves.toMatchObject({
      sourceMode: 'snapshot',
      current: {
        temp: 31,
      },
    });
  });
});

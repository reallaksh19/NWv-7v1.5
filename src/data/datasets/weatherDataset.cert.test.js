import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/weatherService.js', () => ({
  fetchWeather: vi.fn(),
}));

vi.mock('../../services/weatherLocations.js', () => ({
  getConfiguredWeatherCities: vi.fn(),
}));

vi.mock('../../utils/storage.js', () => ({
  getSettings: vi.fn(),
}));

import { fetchWeather } from '../../services/weatherService.js';
import { getConfiguredWeatherCities } from '../../services/weatherLocations.js';
import { getSettings } from '../../utils/storage.js';
import { load } from './weatherDataset.js';

describe('weatherDataset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSettings.mockReturnValue({ weather: {} });
  });

  it('returns frozen envelope with datasetId weather', async () => {
    getConfiguredWeatherCities.mockReturnValue(['chennai']);
    fetchWeather.mockResolvedValue({ temperature: 31, sourceMode: 'live' });

    const env = await load();
    expect(Object.isFrozen(env)).toBe(true);
    expect(env.datasetId).toBe('weather');
  });

  it('returns ok:true when at least one city succeeds and one fails', async () => {
    getConfiguredWeatherCities.mockReturnValue(['chennai', 'muscat']);

    fetchWeather.mockImplementation(async city => {
      if (city === 'muscat') throw new Error('muscat failed');

      return {
        temperature: 31,
        sourceMode: 'live',
        weeklyForecast: [{ day: 'Today' }],
      };
    });

    const env = await load();

    expect(env.ok).toBe(true);
    expect(env.datasetId).toBe('weather');
    expect(env.data.usableCities).toEqual(['chennai']);
    expect(env.data.missingCities).toEqual(['muscat']);
    expect(env.validation.warnings[0]).toContain('weather_missing_cities:muscat');
    expect(env.diagnostics.some(d => d.event === 'weather_city_failed')).toBe(true);
  });

  it('returns ok:false when all configured cities fail', async () => {
    getConfiguredWeatherCities.mockReturnValue(['chennai', 'muscat']);
    fetchWeather.mockRejectedValue(new Error('network down'));

    const env = await load();

    expect(env.ok).toBe(false);
    expect(env.error).toContain('network down');
    expect(env.validation.errors).toContain('weather_unavailable');
    expect(env.data.usableCities).toEqual([]);
    expect(env.data.missingCities).toEqual(['chennai', 'muscat']);
  });

  it('handles non-array configured cities safely', async () => {
    getConfiguredWeatherCities.mockReturnValue(null);

    const env = await load();

    expect(env.ok).toBe(false);
    expect(env.data.cities).toEqual([]);
    expect(env.error).toBe('weather unavailable');
  });

  it('returns ok:false when cities array is empty', async () => {
    getConfiguredWeatherCities.mockReturnValue([]);

    const env = await load();

    expect(env.ok).toBe(false);
    expect(env.data.cities).toHaveLength(0);
  });
});

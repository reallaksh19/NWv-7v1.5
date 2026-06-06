import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ENVELOPE_FRESHNESS } from '../dataEnvelope.js';

vi.mock('../../services/indianMarketStableService.js', () => ({
  fetchAllMarketData: vi.fn(),
}));

vi.mock('../../services/weatherService.js', () => ({
  fetchWeather: vi.fn(),
}));

vi.mock('../../services/weatherLocations.js', () => ({
  getConfiguredWeatherCities: vi.fn(),
}));

vi.mock('../../utils/storage.js', () => ({
  getSettings: vi.fn(),
}));

import { fetchAllMarketData } from '../../services/indianMarketStableService.js';
import { fetchWeather } from '../../services/weatherService.js';
import { getConfiguredWeatherCities } from '../../services/weatherLocations.js';
import { getSettings } from '../../utils/storage.js';
import { load as loadMarket } from './marketDataset.js';
import { load as loadWeather } from './weatherDataset.js';

describe('market/weather stale visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSettings.mockReturnValue({ weather: {} });
    getConfiguredWeatherCities.mockReturnValue(['chennai']);
  });

  it('keeps displayable stale market data visible with a warning', async () => {
    fetchAllMarketData.mockResolvedValue({
      indices: [{ name: 'NIFTY 50', value: 22500, changePercent: 0.4 }],
      fetchedAt: Date.now() - 2 * 60 * 60 * 1000,
      sourceMode: 'cache',
    });

    const env = await loadMarket();

    expect(env.ok).toBe(true);
    expect(env.freshness).toBe(ENVELOPE_FRESHNESS.STALE);
    expect(env.validation.warnings).toContain('market_stale_data:2h');
    expect(env.slo.required).toBe(false);
  });

  it('keeps displayable stale weather data visible with a warning', async () => {
    fetchWeather.mockResolvedValue({
      temperature: 31,
      sourceMode: 'snapshot',
      isStale: true,
      fetchedAt: Date.now() - 3 * 60 * 60 * 1000,
      weeklyForecast: [{ day: 'Today' }],
    });

    const env = await loadWeather();

    expect(env.ok).toBe(true);
    expect(env.freshness).toBe(ENVELOPE_FRESHNESS.STALE);
    expect(env.validation.warnings).toContain('weather_stale_data:chennai');
    expect(env.slo.required).toBe(false);
  });
});

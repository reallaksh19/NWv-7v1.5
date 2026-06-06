import {
  makeEnvelope,
  ENVELOPE_SOURCES,
  ENVELOPE_FRESHNESS,
} from '../dataEnvelope.js';
import { fetchWeather } from '../../services/weatherService.js';
import { getConfiguredWeatherCities } from '../../services/weatherLocations.js';
import { getSettings } from '../../utils/storage.js';

function hasUsableCityWeather(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    (
      Number.isFinite(Number(value.temperature)) ||
      Number.isFinite(Number(value.temp)) ||
      value.current ||
      value.weeklyForecast ||
      value.today ||
      value.tomorrow
    )
  );
}

function getWeatherSourceMode(cityDataMap) {
  const values = Object.values(cityDataMap || {});

  if (values.some(v => v?.sourceMode === 'live')) return ENVELOPE_SOURCES.LIVE;
  if (values.some(v => v?.sourceMode === 'snapshot')) return ENVELOPE_SOURCES.SNAPSHOT;
  if (values.some(v => v?.sourceMode === 'cache')) return ENVELOPE_SOURCES.CACHE;
  if (values.some(v => v?.sourceMode === 'seed')) return ENVELOPE_SOURCES.SEED;

  return ENVELOPE_SOURCES.LIVE;
}

function getWeatherTimestamp(value) {
  const numericFetchedAt = Number(value?.fetchedAt);
  if (Number.isFinite(numericFetchedAt) && numericFetchedAt > 0) return numericFetchedAt;

  const generatedAt = Date.parse(value?.generatedAt || value?.generated_at || '');
  if (Number.isFinite(generatedAt) && generatedAt > 0) return generatedAt;

  return null;
}

function isStaleCityWeather(value) {
  const mode = String(value?.sourceMode || '').toLowerCase();
  if (value?.isStale === true) return true;
  if (mode.includes('stale')) return true;

  const timestamp = getWeatherTimestamp(value);
  if (!timestamp) return false;

  return Date.now() - timestamp > 2 * 60 * 60 * 1000;
}

function safeGetSettings() {
  try {
    return getSettings?.() || {};
  } catch {
    return {};
  }
}

function getConfiguredCities(settings) {
  const configuredCities = getConfiguredWeatherCities(settings);
  return Array.isArray(configuredCities) ? configuredCities : [];
}

export async function load() {
  const settings = safeGetSettings();
  const cities = getConfiguredCities(settings);
  const data = {};
  const errors = [];
  const diagnostics = [];

  for (const city of cities) {
    try {
      const cityData = await fetchWeather(city);
      data[city] = cityData;

      diagnostics.push({
        event: 'weather_city_loaded',
        severity: hasUsableCityWeather(cityData) ? 'info' : 'warn',
        message: `Weather loaded for ${city}`,
        details: {
          city,
          sourceMode: cityData?.sourceMode || 'unknown',
        },
      });
    } catch (error) {
      const message = error?.message || String(error);
      errors.push(`${city}: ${message}`);

      diagnostics.push({
        event: 'weather_city_failed',
        severity: 'error',
        message,
        details: { city },
      });
    }
  }

  const usableCities = Object.entries(data)
    .filter(([, value]) => hasUsableCityWeather(value))
    .map(([city]) => city);

  const missingCities = cities.filter(city => !usableCities.includes(city));
  const ok = usableCities.length > 0;
  const staleCities = usableCities.filter(city => isStaleCityWeather(data[city]));
  const warnings = [
    missingCities.length ? `weather_missing_cities:${missingCities.join(',')}` : null,
    staleCities.length ? `weather_stale_data:${staleCities.join(',')}` : null,
  ].filter(Boolean);

  return makeEnvelope({
    ok,
    datasetId: 'weather',
    data: {
      cities,
      weatherData: data,
      usableCities,
      missingCities,
      staleCities,
    },
    source: getWeatherSourceMode(data),
    freshness: ok
      ? (staleCities.length ? ENVELOPE_FRESHNESS.STALE : ENVELOPE_FRESHNESS.FRESH)
      : ENVELOPE_FRESHNESS.UNKNOWN,
    error: ok ? null : (errors.join('; ') || 'weather unavailable'),
    validation: {
      passed: ok,
      errors: ok ? [] : ['weather_unavailable', ...errors],
      warnings,
    },
    slo: {
      id: 'weatherDatasetBasicValidation',
      required: false,
      passed: ok,
      score: ok ? Math.max(60, 100 - missingCities.length * 10) : 0,
      reasons: ok ? [] : ['weather_unavailable'],
      warnings,
      metrics: {
        configuredCityCount: cities.length,
        usableCityCount: usableCities.length,
        missingCityCount: missingCities.length,
        staleCityCount: staleCities.length,
      },
    },
    diagnostics,
  });
}

export const __weatherDatasetInternalsForTest = {
  hasUsableCityWeather,
  isStaleCityWeather,
  getConfiguredCities,
};

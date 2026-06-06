import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWeather } from '../context/WeatherContext';
import { useSettings } from '../context/SettingsContext';
import {
  DEFAULT_WEATHER_CITIES,
  WEATHER_LOCATION_REGISTRY,
  buildWeatherSettingsWithCities,
  getConfiguredWeatherCities,
  getWeatherLocationLabel,
  getWeatherLocationOptions,
  resolveRegistryKey,
} from '../services/weatherLocations.js';
import { auditWeatherTabQuality } from '../services/pageAuditGrading.js';

const WEATHER_ACTIVE_CITY_KEY = 'weather_active_city';
const LEGACY_WEATHER_ACTIVE_CITY_KEY = 'dw_active_city';

function safeReadActiveCity() {
  try {
    if (typeof window === 'undefined') return null;

    const storage = window.localStorage;
    if (!storage || typeof storage.getItem !== 'function') return null;

    const current = storage.getItem(WEATHER_ACTIVE_CITY_KEY);
    if (current) return current;

    const legacy = storage.getItem(LEGACY_WEATHER_ACTIVE_CITY_KEY);
    if (legacy && typeof storage.setItem === 'function') {
      storage.setItem(WEATHER_ACTIVE_CITY_KEY, legacy);
    }

    return legacy || null;
  } catch {
    return null;
  }
}

function safeWriteActiveCity(city) {
  try {
    if (typeof window === 'undefined') return false;

    const storage = window.localStorage;
    if (!storage || typeof storage.setItem !== 'function') return false;

    storage.setItem(WEATHER_ACTIVE_CITY_KEY, city);
    return true;
  } catch {
    return false;
  }
}

function buildCityLabels(cities) {
  return Object.fromEntries(
    (Array.isArray(cities) ? cities : []).map(city => [
      city,
      getWeatherLocationLabel(city),
    ])
  );
}

function buildCityIcons(cities) {
  return Object.fromEntries(
    (Array.isArray(cities) ? cities : []).map(city => [
      city,
      WEATHER_LOCATION_REGISTRY[city]?.icon || '📍',
    ])
  );
}

function getRenderableWeatherData(weatherData) {
  return weatherData && typeof weatherData === 'object' && !Array.isArray(weatherData)
    ? weatherData
    : {};
}

function resolveActiveWeatherCity(requestedCity, cities) {
  const safeCities = Array.isArray(cities) ? cities : [];
  const canonical = resolveRegistryKey(requestedCity) || requestedCity;

  if (canonical && safeCities.includes(canonical)) {
    return canonical;
  }

  return safeCities[0] || DEFAULT_WEATHER_CITIES[0];
}

export function useWeatherTabViewModel() {
  const {
    weatherData,
    loading,
    error,
    refreshWeather,
    ensureBoot,
    booted,
  } = useWeather();

  const { settings, updateSettings } = useSettings();

  const cities = useMemo(() => (
    getConfiguredWeatherCities(settings)
  ), [settings]);

  const weatherLocationOptions = useMemo(() => (
    getWeatherLocationOptions()
  ), []);

  const [requestedActiveCity, setRequestedActiveCity] = useState(() => (
    resolveRegistryKey(safeReadActiveCity()) || null
  ));

  const activeCity = useMemo(() => (
    resolveActiveWeatherCity(requestedActiveCity, cities)
  ), [requestedActiveCity, cities]);

  useEffect(() => {
    if (typeof ensureBoot === 'function') {
      ensureBoot();
    }
  }, [ensureBoot]);

  useEffect(() => {
    safeWriteActiveCity(activeCity);
  }, [activeCity]);

  const setActiveCity = useCallback((city) => {
    const canonical = resolveRegistryKey(city) || city;

    if (canonical) {
      setRequestedActiveCity(canonical);
    }
  }, []);

  const refresh = useCallback(async (force = true) => {
    try {
      if (typeof refreshWeather === 'function') {
        await Promise.resolve(refreshWeather(force));
        return { ok: true };
      }

      return {
        ok: false,
        error: 'Weather refresh handler unavailable.',
      };
    } catch (refreshError) {
      return {
        ok: false,
        error: refreshError?.message || String(refreshError),
      };
    }
  }, [refreshWeather]);

  const saveWeatherCities = useCallback(async (nextCities) => {
    const safeCities = Array.isArray(nextCities)
      ? nextCities
          .map(city => resolveRegistryKey(city))
          .filter(Boolean)
      : [];

    const uniqueCities = [...new Set(safeCities)];

    if (uniqueCities.length === 0) {
      return {
        ok: false,
        error: 'At least one weather city must remain.',
      };
    }

    try {
      const nextSettings = buildWeatherSettingsWithCities(settings, uniqueCities);

      if (typeof updateSettings === 'function') {
        await Promise.resolve(updateSettings(nextSettings));
      }

      if (!uniqueCities.includes(activeCity)) {
        setRequestedActiveCity(uniqueCities[0]);
      }

      if (typeof refreshWeather === 'function') {
        await Promise.resolve(refreshWeather(true));
      }

      return {
        ok: true,
        cities: uniqueCities,
        settings: nextSettings,
      };
    } catch (saveError) {
      return {
        ok: false,
        error: saveError?.message || String(saveError),
      };
    }
  }, [activeCity, refreshWeather, settings, updateSettings]);

  const addWeatherCity = useCallback((cityValue) => {
    const canonical = resolveRegistryKey(cityValue);

    if (!canonical) {
      return {
        ok: false,
        error: 'Select a supported city from the list.',
      };
    }

    if (cities.includes(canonical)) {
      return {
        ok: false,
        error: `${getWeatherLocationLabel(canonical)} is already added.`,
      };
    }

    return saveWeatherCities([...cities, canonical]);
  }, [cities, saveWeatherCities]);

  const removeWeatherCity = useCallback((cityValue) => {
    const canonical = resolveRegistryKey(cityValue);

    if (!canonical) {
      return {
        ok: false,
        error: 'Weather city not found.',
      };
    }

    if (cities.length <= 1) {
      return {
        ok: false,
        error: 'At least one weather city must remain.',
      };
    }

    return saveWeatherCities(cities.filter(city => city !== canonical));
  }, [cities, saveWeatherCities]);

  const resetWeatherCities = useCallback(() => (
    saveWeatherCities([...DEFAULT_WEATHER_CITIES])
  ), [saveWeatherCities]);

  const displayData = useMemo(() => (
    getRenderableWeatherData(weatherData)
  ), [weatherData]);

  const activeCityData = displayData?.[activeCity] ||
    displayData?.[cities[0]] ||
    displayData?.chennai ||
    null;

  const hasRenderableWeatherData = Object.keys(displayData).length > 0;

  const cityLabels = useMemo(() => (
    buildCityLabels(cities)
  ), [cities]);

  const cityIcons = useMemo(() => (
    buildCityIcons(cities)
  ), [cities]);

  const weatherTabAudit = useMemo(() => (
    auditWeatherTabQuality({
      weatherData: displayData,
      cities,
      activeCity,
      loading,
      error,
    })
  ), [displayData, cities, activeCity, loading, error]);

  const locationManagerProps = useMemo(() => ({
    cities,
    options: weatherLocationOptions,
    cityLabels,
    cityIcons,
    onAddCity: addWeatherCity,
    onRemoveCity: removeWeatherCity,
    onResetCities: resetWeatherCities,
  }), [
    cities,
    weatherLocationOptions,
    cityLabels,
    cityIcons,
    addWeatherCity,
    removeWeatherCity,
    resetWeatherCities,
  ]);

  const detailedWeatherCardProps = useMemo(() => ({
    weatherData: displayData,
    activeCity,
    onActiveCityChange: setActiveCity,
    cities,
    cityLabels,
    cityIcons,
  }), [
    displayData,
    activeCity,
    setActiveCity,
    cities,
    cityLabels,
    cityIcons,
  ]);

  const stickyHeaderProps = useMemo(() => ({
    weatherData: displayData,
    activeCity,
    cities,
    onRefresh: () => refresh(true),
    loading,
  }), [
    displayData,
    activeCity,
    cities,
    refresh,
    loading,
  ]);

  const cityComparisonProps = useMemo(() => ({
    weatherData: displayData,
    cities,
  }), [displayData, cities]);

  const planningSummaryProps = useMemo(() => ({
    cityData: activeCityData,
    cityName: activeCity,
  }), [activeCityData, activeCity]);

  const weeklyForecastProps = useMemo(() => ({
    forecast: activeCityData?.weeklyForecast,
    cityName: activeCity,
  }), [activeCityData, activeCity]);

  return {
    weatherData: displayData,
    rawWeatherData: weatherData,

    cities,
    activeCity,
    activeCityData,
    cityLabels,
    cityIcons,
    weatherLocationOptions,

    loading,
    error,
    booted,
    hasRenderableWeatherData,
    weatherTabAudit,

    setActiveCity,
    refreshWeather: refresh,
    addWeatherCity,
    removeWeatherCity,
    resetWeatherCities,

    locationManagerProps,
    detailedWeatherCardProps,
    stickyHeaderProps,
    cityComparisonProps,
    planningSummaryProps,
    weeklyForecastProps,
  };
}

export const __weatherTabViewModelInternalsForTest = {
  WEATHER_ACTIVE_CITY_KEY,
  safeReadActiveCity,
  safeWriteActiveCity,
  buildCityLabels,
  buildCityIcons,
  getRenderableWeatherData,
  resolveActiveWeatherCity,
};

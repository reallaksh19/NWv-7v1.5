import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import {
  DEFAULT_WEATHER_CITIES,
  WEATHER_LOCATION_REGISTRY,
} from '../services/weatherLocations.js';
import {
  __weatherTabViewModelInternalsForTest,
} from '../viewModels/useWeatherTabViewModel.js';
import {
  __weatherLocationManagerInternalsForTest,
} from '../components/weather/WeatherLocationManager.internals.js';

const {
  buildCityLabels,
  buildCityIcons,
  getRenderableWeatherData,
} = __weatherTabViewModelInternalsForTest;

const {
  getCityDisplay,
  getCityIcon,
  optionMatchesSearch,
} = __weatherLocationManagerInternalsForTest;

const settingsPage = fs.readFileSync('src/pages/SettingsPage.jsx', 'utf8');
const settingsWeatherManager = fs.readFileSync('src/components/weather/SettingsWeatherLocationManager.jsx', 'utf8');
const weatherPage = fs.readFileSync('src/pages/WeatherPage.jsx', 'utf8');
const weatherVm = fs.readFileSync('src/viewModels/useWeatherTabViewModel.js', 'utf8');
const weatherLocationManager = fs.readFileSync('src/components/weather/WeatherLocationManager.jsx', 'utf8');

describe('Release 6K Weather ViewModel binding', () => {
  it('WeatherPage uses ViewModel and passes props to components', () => {
    expect(weatherPage).toContain('useWeatherTabViewModel');
    expect(weatherPage).not.toContain('useWeather()');
    expect(weatherPage).not.toContain('useSettings()');
    expect(weatherPage).toContain('locationManagerProps');
    expect(weatherPage).toContain('detailedWeatherCardProps');
    expect(weatherPage).toContain('stickyHeaderProps');
    expect(weatherPage).toContain('cityComparisonProps');
    expect(weatherPage).toContain('planningSummaryProps');
    expect(weatherPage).toContain('weeklyForecastProps');
  });

  it('WeatherLocationManager is prop-driven — no context imports', () => {
    expect(weatherLocationManager).not.toContain("from '../../context/WeatherContext'");
    expect(weatherLocationManager).not.toContain("from '../../context/SettingsContext'");
    expect(weatherLocationManager).not.toContain('useSettings');
    expect(weatherLocationManager).not.toContain('useWeather');
    expect(weatherLocationManager).toContain('onAddCity = null');
    expect(weatherLocationManager).toContain('onRemoveCity = null');
    expect(weatherLocationManager).toContain('onResetCities = null');
  });

  it('Weather ViewModel owns context, settings, boot, refresh, and audit', () => {
    expect(weatherVm).toContain("from '../context/WeatherContext'");
    expect(weatherVm).toContain("from '../context/SettingsContext'");
    expect(weatherVm).toContain('useWeather');
    expect(weatherVm).toContain('useSettings');
    expect(weatherVm).toContain('ensureBoot');
    expect(weatherVm).toContain('refreshWeather');
    expect(weatherVm).toContain('auditWeatherTabQuality');
    expect(weatherVm).toContain('locationManagerProps');
  });

  it('SettingsPage uses compatibility binding for WeatherLocationManager', () => {
    expect(settingsPage).not.toContain('<WeatherLocationManager />');
    expect(settingsPage).toContain('SettingsWeatherLocationManager');

    expect(settingsWeatherManager).toContain('useWeatherTabViewModel');
    expect(settingsWeatherManager).toContain('<WeatherLocationManager');
    expect(settingsWeatherManager).toContain('{...locationManagerProps}');

    expect(settingsWeatherManager).not.toContain("from '../../context/WeatherContext'");
    expect(settingsWeatherManager).not.toContain("from '../../context/SettingsContext'");
  });

  it('location registry has exactly 300 selectable cities; Colombo stays in registry but is no longer a default', () => {
    const locationsModuleText = fs.readFileSync('src/services/weatherLocations.js', 'utf8');

    // Colombo removed from defaults per user request (still selectable in the registry).
    expect(locationsModuleText).toContain("DEFAULT_WEATHER_CITIES = ['chennai', 'trichy', 'muscat']");

    expect(Object.keys(WEATHER_LOCATION_REGISTRY)).toHaveLength(300);
    expect(DEFAULT_WEATHER_CITIES).toEqual(['chennai', 'trichy', 'muscat']);
    expect(WEATHER_LOCATION_REGISTRY.colombo).toBeTruthy();
  });

  it('getRenderableWeatherData normalizes non-object inputs', () => {
    expect(getRenderableWeatherData(null)).toEqual({});
    expect(getRenderableWeatherData(undefined)).toEqual({});
    expect(getRenderableWeatherData([])).toEqual({});
    expect(getRenderableWeatherData({ chennai: {} })).toEqual({ chennai: {} });
  });

  it('buildCityLabels produces correct label map', () => {
    const labels = buildCityLabels(['chennai', 'muscat']);
    expect(labels.chennai).toBe('Chennai');
    expect(labels.muscat).toBe('Muscat');
  });

  it('buildCityIcons produces icon map from registry', () => {
    const icons = buildCityIcons(['chennai', 'trichy']);
    expect(icons.chennai).toBe('🏛️');
    expect(icons.trichy).toBe('🏯');
  });

  it('getCityDisplay falls back to city key when no label provided', () => {
    expect(getCityDisplay('chennai', { chennai: 'Chennai' })).toBe('Chennai');
    expect(getCityDisplay('unknown', {})).toBe('unknown');
  });

  it('getCityIcon falls back to pin emoji when no icon provided', () => {
    expect(getCityIcon('chennai', { chennai: '🏛️' })).toBe('🏛️');
    expect(getCityIcon('unknown', {})).toBe('📍');
  });

  it('optionMatchesSearch filters by label, country, region', () => {
    const option = { label: 'Chennai', country: 'India', region: 'Tamil Nadu', searchText: 'chennai india tamil nadu' };
    expect(optionMatchesSearch(option, 'chennai')).toBe(true);
    expect(optionMatchesSearch(option, 'berlin')).toBe(false);
    expect(optionMatchesSearch(option, '')).toBe(true);
  });
});

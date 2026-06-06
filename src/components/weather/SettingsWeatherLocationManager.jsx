import React from 'react';
import WeatherLocationManager from './WeatherLocationManager.jsx';
import { useWeatherTabViewModel } from '../../viewModels/useWeatherTabViewModel.js';

/**
 * SettingsWeatherLocationManager
 *
 * Compatibility binding for Settings → Weather → Locations.
 *
 * WeatherLocationManager is now a pure prop-driven UI component.
 * This wrapper binds it to the Weather ViewModel so SettingsPage does not need
 * to know about WeatherContext, SettingsContext, localStorage, refresh, or
 * location-library validation.
 */
export default function SettingsWeatherLocationManager({
  compact = false,
}) {
  const {
    locationManagerProps,
  } = useWeatherTabViewModel();

  return (
    <WeatherLocationManager
      {...locationManagerProps}
      compact={compact}
    />
  );
}

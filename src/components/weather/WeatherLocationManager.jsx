import React, { useMemo, useState } from 'react';
import {
  resolveRegistryKey,
} from '../../services/weatherLocations.js';
import './WeatherLocationManager.css';

function getCityDisplay(city, cityLabels = {}) {
  return cityLabels[city] || city;
}

function getCityIcon(city, cityIcons = {}) {
  return cityIcons[city] || '📍';
}

function optionMatchesSearch(option, searchTerm) {
  const search = String(searchTerm || '').trim().toLowerCase();
  if (!search) return true;

  return String(option.searchText || `${option.label} ${option.country} ${option.region}`)
    .toLowerCase()
    .includes(search);
}

export default function WeatherLocationManager({
  compact = false,
  cities = [],
  options = [],
  cityLabels = {},
  cityIcons = {},
  onAddCity = null,
  onRemoveCity = null,
  onResetCities = null,
}) {
  const [inputValue, setInputValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);

  const safeCities = useMemo(() => (
    Array.isArray(cities) ? cities : []
  ), [cities]);
  const safeOptions = useMemo(() => (
    Array.isArray(options) ? options : []
  ), [options]);

  const availableToAdd = useMemo(() => (
    safeOptions
      .filter(option => !safeCities.includes(option.key))
      .filter(option => optionMatchesSearch(option, searchTerm))
  ), [safeOptions, safeCities, searchTerm]);

  async function addCity(cityValue = inputValue) {
    const canonical = resolveRegistryKey(cityValue);

    if (!canonical) {
      setMessage('Select a supported city from the list, then press Add.');
      return { ok: false, error: 'Select a supported city from the list, then press Add.' };
    }

    if (safeCities.includes(canonical)) {
      const duplicateMessage = `${getCityDisplay(canonical, cityLabels)} is already in your weather list.`;
      setMessage(duplicateMessage);
      return { ok: false, error: duplicateMessage };
    }

    try {
      const result = typeof onAddCity === 'function'
        ? await Promise.resolve(onAddCity(canonical))
        : { ok: false, error: 'Add city handler unavailable.' };

      if (result?.ok === false) {
        setMessage(result.error || 'Unable to add city.');
        return result;
      }

      setInputValue('');
      setSearchTerm('');
      setMessage(`${getCityDisplay(canonical, cityLabels)} added.`);
      return { ok: true };
    } catch (error) {
      const errorMessage = error?.message || String(error);
      setMessage(errorMessage);
      return { ok: false, error: errorMessage };
    }
  }

  async function removeCity(city) {
    const canonical = resolveRegistryKey(city);

    if (!canonical) {
      setMessage('Weather city not found.');
      return { ok: false, error: 'Weather city not found.' };
    }

    if (safeCities.length <= 1) {
      setMessage('At least one weather city must remain.');
      return { ok: false, error: 'At least one weather city must remain.' };
    }

    try {
      const result = typeof onRemoveCity === 'function'
        ? await Promise.resolve(onRemoveCity(canonical))
        : { ok: false, error: 'Remove city handler unavailable.' };

      if (result?.ok === false) {
        setMessage(result.error || 'Unable to remove city.');
        return result;
      }

      setMessage(`${getCityDisplay(canonical, cityLabels)} removed.`);
      return { ok: true };
    } catch (error) {
      const errorMessage = error?.message || String(error);
      setMessage(errorMessage);
      return { ok: false, error: errorMessage };
    }
  }

  async function resetToDefaults() {
    try {
      const result = typeof onResetCities === 'function'
        ? await Promise.resolve(onResetCities())
        : { ok: false, error: 'Reset handler unavailable.' };

      if (result?.ok === false) {
        setMessage(result.error || 'Unable to reset weather cities.');
        return result;
      }

      setInputValue('');
      setSearchTerm('');
      setMessage('Reset to default weather cities.');
      return { ok: true };
    } catch (error) {
      const errorMessage = error?.message || String(error);
      setMessage(errorMessage);
      return { ok: false, error: errorMessage };
    }
  }

  const selectedCityText = safeCities
    .map(city => getCityDisplay(city, cityLabels))
    .join(' · ');

  if (!open) {
    return (
      <section
        className={`wlm-collapsed ${compact ? 'wlm-collapsed--compact' : ''}`}
        data-weather-location-manager="collapsed"
      >
        <div className="wlm-collapsed__copy">
          <strong>Weather locations</strong>
          <span>{safeCities.length} selected · {selectedCityText}</span>
        </div>

        <div className="wlm-collapsed__actions">
          <button className="wlm-toggle" type="button" onClick={() => setOpen(true)}>
            Manage
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`wlm-panel ${compact ? 'wlm-panel--compact' : ''}`}
      data-weather-location-manager="open"
    >
      <div className="wlm-header">
        <div>
          <span className="wlm-eyebrow">Weather locations</span>
          <h3>Add / delete locations</h3>
          <p>
            Choose a supported city from the library, press <strong>Add</strong>,
            or remove cities using the <strong>×</strong> button.
          </p>
        </div>

        <button className="wlm-toggle wlm-close" type="button" onClick={() => setOpen(false)}>
          Done
        </button>
      </div>

      <div className="wlm-help" data-weather-location-help="true">
        <span>
          To add: choose a city from the list below and press <strong>Add</strong>.
          To delete: press the <strong>×</strong> button next to a selected city.
        </span>
        <span>
          Supported now: {safeOptions.length} selectable cities.
        </span>
      </div>

      <div className="wlm-current">
        <span className="wlm-section-label">Selected cities</span>

        <div className="wlm-chip-row">
          {safeCities.map(city => (
            <span key={city} className="wlm-chip">
              <span>{getCityIcon(city, cityIcons)} {getCityDisplay(city, cityLabels)}</span>

              <button
                type="button"
                onClick={() => removeCity(city)}
                disabled={safeCities.length <= 1}
                aria-label={`Remove ${getCityDisplay(city, cityLabels)}`}
                title={`Remove ${getCityDisplay(city, cityLabels)}`}
                data-weather-delete-city={city}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="wlm-add-row">
        <input
          className="wlm-select"
          type="search"
          value={searchTerm}
          onChange={event => {
            setSearchTerm(event.target.value);
            setMessage('');
          }}
          placeholder="Search 300-city library..."
          aria-label="Search weather city library"
        />

        <select
          className="wlm-select"
          value={inputValue}
          onChange={event => {
            setInputValue(event.target.value);
            setMessage('');
          }}
          aria-label="Select weather city to add"
        >
          <option value="">Select city to add…</option>

          {availableToAdd.map(option => (
            <option key={option.key} value={option.key}>
              {option.icon} {option.label} — {option.region ? `${option.region}, ` : ''}{option.country}
            </option>
          ))}
        </select>

        <button
          className="wlm-add-btn"
          type="button"
          onClick={() => addCity()}
          disabled={!inputValue}
        >
          Add
        </button>
      </div>

      {availableToAdd.length > 0 && (
        <div className="wlm-quick-add" data-weather-quick-add-list="true">
          <span className="wlm-section-label">
            Quick add {searchTerm ? `· ${availableToAdd.length} match${availableToAdd.length === 1 ? '' : 'es'}` : ''}
          </span>

          <div className="wlm-quick-add__buttons">
            {availableToAdd.slice(0, 12).map(option => (
              <button key={option.key} type="button" onClick={() => addCity(option.key)}>
                + {option.icon} {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="wlm-footer">
        <button className="wlm-reset" type="button" onClick={resetToDefaults}>
          Reset defaults
        </button>

        {message && <span className="wlm-message" role="status">{message}</span>}
      </div>
    </section>
  );
}

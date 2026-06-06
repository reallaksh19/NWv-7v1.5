import React from 'react';
import './TravelLocationSettingsPanel.css';
import { FALLBACK_PROFILE } from './TravelLocationSettingsPanel.internals.js';

export default function TravelLocationSettingsPanel({
  profile = null,
  options = [],
  onUpdateTravelLocation = null,
}) {
  const safeProfile = profile || FALLBACK_PROFILE;
  const safeOptions = Array.isArray(options) ? options : [];

  function updateTravelLocation(patch) {
    if (typeof onUpdateTravelLocation !== 'function') return null;

    try {
      return onUpdateTravelLocation(patch);
    } catch (error) {
      console.warn('[TravelLocationSettingsPanel] update failed', {
        message: error?.message || String(error),
      });

      return null;
    }
  }

  return (
    <section className="travel-location-settings" data-travel-location-settings="true">
      <div className="travel-location-settings__copy">
        <span>Travel location</span>
        <h3>Prioritise local stories</h3>
        <p>
          Use this when travelling. Colombo accepts the common typo "Columbo" and uses Sri Lanka news edition.
        </p>
      </div>

      <div className="travel-location-settings__controls">
        <label className="travel-location-settings__toggle">
          <input
            type="checkbox"
            checked={Boolean(safeProfile.prioritizeStories)}
            onChange={event => updateTravelLocation({
              city: safeProfile.key,
              prioritizeStories: event.target.checked,
            })}
          />
          <span>Boost local stories</span>
        </label>

        <label>
          <span>Current travel city</span>
          <select
            value={safeProfile.key}
            onChange={event => updateTravelLocation({
              city: event.target.value,
              enabled: true,
              prioritizeStories: true,
            })}
          >
            {safeOptions.map(option => (
              <option key={option.key} value={option.key}>
                {option.icon} {option.label} â€” {option.country}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="travel-location-settings__status">
        <strong>{safeProfile.icon} {safeProfile.display}</strong>
        <span>{safeProfile.countryLabel} Â· source: {safeProfile.source}</span>
      </div>
    </section>
  );
}

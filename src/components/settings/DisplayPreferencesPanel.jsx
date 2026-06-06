import React from 'react';
import './DisplayPreferencesPanel.css';

export default function DisplayPreferencesPanel({
  showOnThisDay = false,
  onToggleOnThisDay = null,
}) {
  function handleToggle(event) {
    if (typeof onToggleOnThisDay !== 'function') return null;

    try {
      return onToggleOnThisDay(event.target.checked);
    } catch (error) {
      console.warn('[DisplayPreferencesPanel] toggle failed', {
        message: error?.message || String(error),
      });

      return null;
    }
  }

  return (
    <section className="display-preferences-panel" data-display-preferences-panel="true">
      <div className="display-preferences-panel__copy">
        <span className="display-preferences-panel__eyebrow">Home display</span>
        <h3>Optional widgets</h3>
        <p>
          "On This Day" is hidden by default on mobile and desktop. Turn it on only when you want it in the feed.
        </p>
      </div>

      <label className="display-preferences-panel__toggle">
        <input
          type="checkbox"
          checked={Boolean(showOnThisDay)}
          onChange={handleToggle}
        />
        <span>
          <strong>Show "On This Day"</strong>
          <em>{showOnThisDay ? 'Enabled' : 'Off by default'}</em>
        </span>
      </label>
    </section>
  );
}

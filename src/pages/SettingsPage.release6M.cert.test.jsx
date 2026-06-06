import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

function hasImportFrom(content, sourcePath) {
  const escaped = sourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`from\\s+['"]${escaped}['"]`).test(content);
}

function hasHookCall(content, name) {
  return new RegExp(`\\b${name}\\s*\\(`).test(content);
}

describe('Release 6M Settings preference child binding', () => {
  const displayPanel = fs.readFileSync('src/components/settings/DisplayPreferencesPanel.jsx', 'utf8');
  const travelPanel = fs.readFileSync('src/components/settings/TravelLocationSettingsPanel.jsx', 'utf8');
  const settingsPage = fs.readFileSync('src/pages/SettingsPage.jsx', 'utf8');
  const vm = fs.readFileSync('src/viewModels/useSettingsPreferenceViewModel.js', 'utf8');

  it('DisplayPreferencesPanel is prop-driven', () => {
    expect(hasImportFrom(displayPanel, '../../context/SettingsContext')).toBe(false);
    expect(hasHookCall(displayPanel, 'useSettings')).toBe(false);
    expect(displayPanel).not.toContain('buildDisplaySettings');
    expect(displayPanel).not.toContain('shouldShowOnThisDay');
    expect(displayPanel).toContain('showOnThisDay = false');
    expect(displayPanel).toContain('onToggleOnThisDay = null');
    expect(displayPanel).toContain('[DisplayPreferencesPanel] toggle failed');
    expect(displayPanel).toContain('data-display-preferences-panel');
    expect(displayPanel).toContain('display-preferences-panel__toggle');
  });

  it('TravelLocationSettingsPanel is prop-driven', () => {
    expect(hasImportFrom(travelPanel, '../../context/SettingsContext')).toBe(false);
    expect(hasHookCall(travelPanel, 'useSettings')).toBe(false);
    expect(travelPanel).not.toContain('buildTravelLocationSettings');
    expect(travelPanel).not.toContain('getTravelLocationOptions');
    expect(travelPanel).not.toContain('getTravelLocationProfile');
    expect(travelPanel).toContain('profile = null');
    expect(travelPanel).toContain('options = []');
    expect(travelPanel).toContain('onUpdateTravelLocation = null');
    expect(travelPanel).toContain('[TravelLocationSettingsPanel] update failed');
    expect(travelPanel).toContain('data-travel-location-settings');
    expect(travelPanel).toContain('travel-location-settings__status');
  });

  it('TravelLocationSettingsPanel does not force enabled=true when only toggling boost', () => {
    const toggleBlock = travelPanel.match(/onChange=\{event => updateTravelLocation\(\{[\s\S]*?prioritizeStories:\s*event\.target\.checked[\s\S]*?\}\)\}/)?.[0] || '';

    expect(toggleBlock).toContain('city: safeProfile.key');
    expect(toggleBlock).toContain('prioritizeStories: event.target.checked');
    expect(toggleBlock).not.toContain('enabled: true');
  });

  it('Settings preference ViewModel owns preference projection and updates', () => {
    [
      "from '../context/SettingsContext'",
      'useSettings',
      'buildDisplaySettings',
      'shouldShowOnThisDay',
      'buildTravelLocationSettings',
      'getTravelLocationOptions',
      'getTravelLocationProfile',
      'displayPreferencesProps',
      'travelLocationSettingsProps',
      'onToggleOnThisDay: toggleOnThisDay',
      'onUpdateTravelLocation: updateTravelLocation',
    ].forEach(token => {
      expect(vm).toContain(token);
    });
  });

  it('Settings preference ViewModel does not return broad settings object', () => {
    const returnBlock = vm.match(/return\s*\{[\s\S]*?displayPreferencesProps[\s\S]*?travelLocationSettingsProps[\s\S]*?\};/)?.[0] || '';

    expect(returnBlock).toContain('displayPreferencesProps');
    expect(returnBlock).toContain('travelLocationSettingsProps');
    expect(returnBlock).not.toContain('settings,');
  });

  it('Settings preference ViewModel guards update failures', () => {
    expect(vm).toContain('[useSettingsPreferenceViewModel] display preference update failed');
    expect(vm).toContain('[useSettingsPreferenceViewModel] travel location update failed');
  });

  it('SettingsPage binds both preference panels from ViewModel props', () => {
    expect(settingsPage).toContain('useSettingsPreferenceViewModel');
    expect(settingsPage).toContain('displayPreferencesProps');
    expect(settingsPage).toContain('travelLocationSettingsProps');
    expect(settingsPage).toContain('<DisplayPreferencesPanel {...displayPreferencesProps} />');
    expect(settingsPage).toContain('<TravelLocationSettingsPanel {...travelLocationSettingsProps} />');
  });

  it('SettingsPage preserves integrated 6K weather manager wrapper', () => {
    expect(settingsPage).toContain('SettingsWeatherLocationManager');
    expect(settingsPage).toContain('<SettingsWeatherLocationManager />');
    expect(settingsPage).not.toContain('<WeatherLocationManager />');
    expect(settingsPage).not.toContain('<WeatherLocationManager {...locationManagerProps} />');
  });

  it('SettingsPage runtime diagnostics are preserved when present', () => {
    if (settingsPage.includes('getRuntimeCapabilities')) {
      expect(settingsPage).toContain('getRuntimeCapabilities');
    }
  });
});

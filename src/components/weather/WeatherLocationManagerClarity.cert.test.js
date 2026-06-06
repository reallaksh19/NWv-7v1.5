import { describe, expect, it } from 'vitest';
import fs from 'fs';

describe('Weather location manager clarity certification', () => {
  const component = fs.readFileSync('src/components/weather/WeatherLocationManager.jsx', 'utf8');
  const css = fs.readFileSync('src/components/weather/WeatherLocationManager.css', 'utf8');

  it('explains how to add and delete cities', () => {
    expect(component).toContain('To add: choose a city');
    expect(component).toContain('To delete: press');
    expect(component).toContain('data-weather-location-help');
  });

  it('provides city management without a dedicated Colombo shortcut', () => {
    // Colombo-specific one-click button was removed per user request; cities are
    // managed through the standard add/delete flow instead.
    expect(component).toContain('availableToAdd');
    expect(component).toContain('data-weather-location-manager');
  });

  it('provides labelled delete buttons', () => {
    expect(component).toContain('data-weather-delete-city');
    expect(component).toContain('Remove ');
    expect(component).toContain('removeCity');
  });

  it('provides quick-add list for available cities', () => {
    expect(component).toContain('data-weather-quick-add-list');
    expect(component).toContain('availableToAdd.map');
  });

  it('has professional visual classes', () => {
    expect(css).toContain('.wlm-help');
    expect(css).toContain('.wlm-quick-add__buttons');
    expect(css).toContain('.wlm-chip button:hover');
  });
});

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

function hasImportFrom(content, sourcePath) {
  const escaped = sourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`from\\s+['"]${escaped}['"]`).test(content);
}

function hasHookCall(content, name) {
  return new RegExp(`\\b${name}\\s*\\(`).test(content);
}

describe('Release 6N OnThisDay visibility controller binding', () => {
  const controller = fs.readFileSync('src/components/settings/OnThisDayVisibilityController.jsx', 'utf8');
  const vm = fs.readFileSync('src/viewModels/useOnThisDayVisibilityViewModel.js', 'utf8');
  const app = fs.readFileSync('src/App.jsx', 'utf8');

  it('OnThisDayVisibilityController is prop-driven', () => {
    expect(hasImportFrom(controller, '../../context/SettingsContext')).toBe(false);
    expect(hasHookCall(controller, 'useSettings')).toBe(false);
    expect(hasImportFrom(controller, '../../services/displayPreferences.js')).toBe(false);
    expect(controller).not.toContain('shouldShowOnThisDay(settings)');
    expect(controller).toContain('shouldShowOnThisDayWidget = false');
    expect(controller).toContain('[shouldShowOnThisDayWidget]');
  });

  it('OnThisDayVisibilityController preserves DOM behavior utilities', () => {
    [
      'findOnThisDayContainers',
      'hideOnThisDay',
      'showOnThisDay',
      'isOnThisDayText',
      'MutationObserver',
      "typeof MutationObserver === 'undefined'",
      'data-nw-hidden-on-this-day',
      'aria-hidden',
      'settings-page',
      'data-on-this-day',
      'data-widget="on-this-day"',
      'class*="on-this-day"',
      'id*="on-this-day"',
    ].forEach(token => {
      expect(controller).toContain(token);
    });
  });

  it('narrow visibility ViewModel owns settings/policy lookup', () => {
    expect(vm).toContain("from '../context/SettingsContext'");
    expect(vm).toContain("from '../services/displayPreferences.js'");
    expect(vm).toContain('useSettings');
    expect(vm).toContain('shouldShowOnThisDay');
    expect(vm).toContain('onThisDayVisibilityControllerProps');
    expect(vm).toContain('shouldShowOnThisDayWidget');
  });

  it('App uses binding wrapper instead of bare controller', () => {
    expect(app).toContain('useOnThisDayVisibilityViewModel');
    expect(app).toContain('function OnThisDayVisibilityBinding');
    expect(app).toContain('onThisDayVisibilityControllerProps');
    expect(app).toContain('<OnThisDayVisibilityController');
    expect(app).toContain('{...onThisDayVisibilityControllerProps}');
    expect(app).toContain('<OnThisDayVisibilityBinding />');
    expect(app).not.toContain('<OnThisDayVisibilityController />');
  });

  it('App keeps SettingsProvider in place', () => {
    expect(app).toContain('<SettingsProvider>');
    expect(app).toContain('</SettingsProvider>');
  });
});

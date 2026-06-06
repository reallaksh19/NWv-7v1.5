import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import {
  __refreshPageViewModelInternalsForTest,
} from '../viewModels/useRefreshPageViewModel.js';

const {
  REFRESH_SECTION_CONFIG,
  getSelectedRefreshSections,
  makeToggleState,
  getRefreshOutcome,
  callRefresh,
} = __refreshPageViewModelInternalsForTest;

function hasImportFrom(content, sourcePath) {
  const escaped = sourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`from\\s+['"]${escaped}['"]`).test(content);
}

function hasHookCall(content, name) {
  return new RegExp(`\\b${name}\\s*\\(`).test(content);
}

describe('Release 6O Refresh page ViewModel binding', () => {
  const refreshPage = fs.readFileSync('src/pages/RefreshPage.jsx', 'utf8');
  const vm = fs.readFileSync('src/viewModels/useRefreshPageViewModel.js', 'utf8');

  it('RefreshPage no longer imports or calls refresh contexts directly', () => {
    expect(hasImportFrom(refreshPage, '../context/WeatherContext')).toBe(false);
    expect(hasImportFrom(refreshPage, '../context/NewsContext')).toBe(false);
    expect(hasImportFrom(refreshPage, '../context/MarketContext')).toBe(false);

    expect(hasHookCall(refreshPage, 'useWeather')).toBe(false);
    expect(hasHookCall(refreshPage, 'useNews')).toBe(false);
    expect(hasHookCall(refreshPage, 'useMarket')).toBe(false);

    expect(refreshPage).toContain('useRefreshPageViewModel');
  });

  it('RefreshPage preserves Header shell runtime binding', () => {
    expect(refreshPage).toContain('useShellRuntimeProps');
    expect(refreshPage).toContain('shellRuntimeProps={shellRuntimeProps}');
  });

  it('Refresh ViewModel owns Weather, News, and Market contexts', () => {
    expect(vm).toContain("from '../context/WeatherContext'");
    expect(vm).toContain("from '../context/NewsContext'");
    expect(vm).toContain("from '../context/MarketContext'");
    expect(vm).toContain('useWeather');
    expect(vm).toContain('useNews');
    expect(vm).toContain('useMarket');
  });

  it('Refresh ViewModel performs real market refresh', () => {
    expect(vm).toContain('refreshMarket');
    expect(vm).toContain('promises.push(callRefresh(refreshMarket))');
    expect(vm).not.toContain('market timestamp only');
    expect(vm).not.toContain('Market data not yet in context');
  });

  it('Refresh ViewModel owns guarded orchestration and timestamp write timing', () => {
    expect(vm).toContain('callRefresh');
    expect(vm).toContain('Promise.allSettled');
    expect(vm).toContain('getRefreshOutcome');
    expect(vm).toContain('touchedSections.forEach(section => setLastRefresh(section))');
    expect(vm).toContain('if (outcome.ok)');
  });

  it('refresh helpers work as expected', async () => {
    expect(REFRESH_SECTION_CONFIG.length).toBeGreaterThanOrEqual(8);

    expect(getSelectedRefreshSections({
      world: true,
      weather: false,
      india: true,
    })).toEqual(['world', 'india']);

    expect(makeToggleState(true)).toMatchObject({
      world: true,
      india: true,
      weather: true,
      market: true,
    });

    expect(getRefreshOutcome([
      { status: 'fulfilled', value: true },
    ])).toMatchObject({
      ok: true,
      degraded: false,
    });

    expect(getRefreshOutcome([
      { status: 'fulfilled', value: true },
      { status: 'rejected', reason: new Error('x') },
    ])).toMatchObject({
      ok: true,
      degraded: true,
      failed: ['x'],
    });

    expect(getRefreshOutcome([
      { status: 'rejected', reason: new Error('x') },
    ])).toMatchObject({
      ok: false,
      degraded: false,
      failed: ['x'],
    });

    await expect(callRefresh(() => 'ok')).resolves.toBe('ok');
    await expect(callRefresh(() => {
      throw new Error('sync failure');
    })).rejects.toThrow('sync failure');
  });

  it('RefreshPage preserves core UI tokens', () => {
    [
      'refresh-page',
      'refresh-info',
      'settings-section',
      'settings-section__title',
      'modern-card',
      'settings-item',
      'refresh-btn',
      'schedule-card',
      'schedule-item',
    ].forEach(token => {
      expect(refreshPage).toContain(token);
    });
  });
});

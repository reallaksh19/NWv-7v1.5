import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, getSettings } from './storage.js';
import { DEFAULT_MARKET_SETTINGS } from '../config/settings_market.js';
import { getMarketSessionState } from './marketSession.js';

function installLocalStorage(seed = {}) {
  const store = new Map(Object.entries(seed));

  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key) => store.get(key) ?? null),
    setItem: vi.fn((key, value) => store.set(key, String(value))),
    removeItem: vi.fn((key) => store.delete(key)),
  });
}

describe('config evolution', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('merges designated additive arrays so new defaults reach existing saved settings', () => {
    installLocalStorage({
      dailyEventAI_settings: JSON.stringify({
        schemaVersion: 2,
        sources: {
          enabled: ['custom-source'],
        },
        highImpactKeywords: ['Custom Impact'],
      }),
    });

    const settings = getSettings();

    expect(settings.sources.enabled).toEqual(
      expect.arrayContaining([...DEFAULT_SETTINGS.sources.enabled, 'custom-source'])
    );
    expect(settings.highImpactKeywords).toEqual(
      expect.arrayContaining([...DEFAULT_SETTINGS.highImpactKeywords, 'Custom Impact'])
    );
  });

  it('uses an explicit weekday-rules guard beyond the maintained market holiday calendar', () => {
    const state = getMarketSessionState({
      now: new Date('2027-01-26T04:30:00.000Z'),
      lastUpdated: new Date('2027-01-26T04:29:00.000Z').getTime(),
      tradingHolidays: DEFAULT_MARKET_SETTINGS.tradingHolidays,
    });

    expect(state.holidayCalendarStatus).toBe('unknown_year_weekday_rules');
    expect(state.reason).not.toBe('Holiday');
    expect(state.isOpen).toBe(true);
  });
});

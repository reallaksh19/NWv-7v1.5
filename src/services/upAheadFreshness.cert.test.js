import { describe, expect, it } from 'vitest';
import { __upAheadServiceInternalsForTest } from './upAheadService.js';

const {
  filterPastDatedDisplayItems,
  getFestivalFallbackItems,
  isStaticUpAheadFresh,
} = __upAheadServiceInternalsForTest;

describe('Up Ahead freshness and festival fallback', () => {
  it('rejects stale static snapshots before they can feed the planner', () => {
    const now = Date.now();

    expect(isStaticUpAheadFresh({ fetchedAt: now - 2 * 60 * 60 * 1000 }, 12 * 60 * 60 * 1000)).toBe(true);
    expect(isStaticUpAheadFresh({ fetchedAt: now - 30 * 60 * 60 * 1000 }, 12 * 60 * 60 * 1000)).toBe(false);
  });

  it('filters past-dated cards while preserving future items', () => {
    const todayMs = Date.UTC(2026, 4, 29, 0, 0, 0);
    const result = filterPastDatedDisplayItems([
      { id: 'past', title: 'Past rain warning', date: '2026-05-27' },
      { id: 'future', title: 'Future festival', date: '2026-06-17' },
      { id: 'undated', title: 'Undated live alert' },
    ], todayMs);

    expect(result.map(item => item.id)).toEqual(['future', 'undated']);
  });

  it('provides future festival cards for selected Chennai and Muscat locations', () => {
    const result = getFestivalFallbackItems(['Chennai', 'Muscat'], new Date('2026-05-29T12:00:00+05:30'));

    expect(result.length).toBeGreaterThan(0);
    expect(result.every(item => item.date >= '2026-05-29')).toBe(true);
    expect(result.some(item => item.locationCanonical === 'Chennai')).toBe(true);
    expect(result.some(item => item.locationCanonical === 'Muscat')).toBe(true);
  });
});

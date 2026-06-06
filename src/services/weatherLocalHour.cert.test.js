import { describe, expect, it } from 'vitest';
import { getLocationLocalHour } from './weatherService.js';

describe('weather location-local current hour', () => {
  it('uses the registry timezone for non-browser-local cities', () => {
    const instant = new Date('2026-05-30T00:30:00Z');

    expect(getLocationLocalHour('muscat', instant)).toBe(4);
  });
});

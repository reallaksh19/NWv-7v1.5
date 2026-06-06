import { afterEach, describe, expect, it } from 'vitest';
import { toLocalDateKey } from './dateKey.js';

const originalTz = process.env.TZ;

describe('toLocalDateKey', () => {
  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it('formats from local date parts rather than UTC ISO slicing', () => {
    process.env.TZ = 'Asia/Kolkata';
    const localMidnight = new Date(2026, 4, 30, 0, 0, 0);

    expect(toLocalDateKey(localMidnight)).toBe('2026-05-30');
  });

  it('round-trips an existing server date key through the client parser', () => {
    expect(toLocalDateKey('2026-05-30')).toBe('2026-05-30');
  });
});

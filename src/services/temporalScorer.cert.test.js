import { describe, expect, it } from 'vitest';
import { temporalScore } from './temporalScorer.js';
import { DEFAULT_RANKING_POLICY } from '../config/rankingPolicy.js';

const HALF_LIFE_H = DEFAULT_RANKING_POLICY.freshness.halfLifeHours; // 10h from policy

describe('temporalScorer (RC-6 fix: config-driven half-life, no cliff)', () => {
  it('decays monotonically over time', () => {
    const base = 10;
    const now = Date.now();
    const s0 = temporalScore(base, now, now);
    const s6 = temporalScore(base, now - 6 * 3_600_000, now);
    const s12 = temporalScore(base, now - 12 * 3_600_000, now);
    const s24 = temporalScore(base, now - 24 * 3_600_000, now);
    expect(s0).toBeGreaterThan(s6);
    expect(s6).toBeGreaterThan(s12);
    expect(s12).toBeGreaterThan(s24);
  });

  it('half-life matches policy: score at halfLifeHours ≈ baseScore/2', () => {
    const base = 10;
    const now = Date.now();
    const atHalfLife = temporalScore(base, now - HALF_LIFE_H * 3_600_000, now);
    expect(atHalfLife).toBeCloseTo(base / 2, 1);
  });

  it('11h vs 13h differ by less than 15% (no sharp cliff at 12h)', () => {
    const base = 10;
    const now = Date.now();
    const s11 = temporalScore(base, now - 11 * 3_600_000, now);
    const s13 = temporalScore(base, now - 13 * 3_600_000, now);
    const diff = Math.abs(s11 - s13) / s11;
    expect(diff).toBeLessThan(0.15);
  });

  it('returns near-zero (not NaN) for missing publishedAt', () => {
    const s = temporalScore(10, null, Date.now());
    expect(isNaN(s)).toBe(false);
    expect(s).toBeGreaterThanOrEqual(0);
  });
});

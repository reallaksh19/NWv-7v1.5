import { describe, expect, it } from 'vitest';
import { evaluateMarketSlo } from './marketSlo.js';

const GOOD_DATA = {
  indices: [
    { name: 'SENSEX', value: 75000, changePercent: 0.3 },
    { name: 'NIFTY', value: 22000, changePercent: -0.1 },
  ],
  fetchedAt: Date.now(),
  sourceMode: 'live',
};

describe('evaluateMarketSlo', () => {
  it('passes for valid market data', () => {
    const result = evaluateMarketSlo(GOOD_DATA);
    expect(result.passed).toBe(true);
    expect(result.reasons).toHaveLength(0);
    expect(result.score).toBe(100);
    expect(result.required).toBe(true);
  });

  it('fails when indices array is empty', () => {
    const result = evaluateMarketSlo({ ...GOOD_DATA, indices: [] });
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('market_indices_empty');
  });

  it('fails when indices is missing', () => {
    const result = evaluateMarketSlo({ fetchedAt: Date.now(), sourceMode: 'live' });
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('market_indices_empty');
  });

  it('fails when an index has value <= 0', () => {
    const data = {
      ...GOOD_DATA,
      indices: [
        { name: 'SENSEX', value: -100, changePercent: 0 },
        { name: 'NIFTY', value: 22000, changePercent: 0 },
      ],
    };
    const result = evaluateMarketSlo(data);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => r.includes('market_indices_invalid_value'))).toBe(true);
  });

  it('fails when fetchedAt is invalid', () => {
    const result = evaluateMarketSlo({ ...GOOD_DATA, fetchedAt: NaN });
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('market_invalid_timestamp');
  });

  it('warns (does not fail) for extreme % moves > 20%', () => {
    const data = {
      ...GOOD_DATA,
      indices: [{ name: 'SENSEX', value: 75000, changePercent: 25 }],
    };
    const result = evaluateMarketSlo(data);
    expect(result.passed).toBe(true);
    expect(result.warnings.some(w => w.includes('market_extreme_move'))).toBe(true);
  });

  it('handles null/undefined data gracefully', () => {
    const result = evaluateMarketSlo(null);
    expect(result.passed).toBe(false);
  });

  it('exposes metrics', () => {
    const result = evaluateMarketSlo(GOOD_DATA);
    expect(result.metrics.indexCount).toBe(2);
    expect(result.metrics.sourceMode).toBe('live');
  });
});

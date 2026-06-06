import { describe, expect, it } from 'vitest';
import { calculateImpactScore } from './impactScorer.js';

describe('calculateImpactScore — RC-1 severity gate', () => {
  it('does NOT apply the War boost to a game trailer (God of War)', () => {
    const s = calculateImpactScore(
      'God of War Laufey Revealed With Gameplay Trailer',
      'Revealed at State of Play',
      {},
    );
    // Global geo doesn't match, magnitude doesn't match, keyword suppressed
    // scale=1.0 * magnitude=1.0 * keyword=1.0 = 1.0
    expect(s).toBeCloseTo(1.0, 5);
  });

  it('DOES apply the War boost to a real conflict headline', () => {
    const s = calculateImpactScore(
      'West Asia war: Iran missile strike kills dozens in Gulf',
      '',
      { rankingWeights: { impact: { highImpactBoost: 2.5 } } },
    );
    // global geo (1.5) * keyword(2.5) = 3.75, magnitude still 1.0
    expect(s).toBeGreaterThanOrEqual(2.5);
  });

  it('records suppression decision in _lastDecisions for game trailer', () => {
    calculateImpactScore('God of War Laufey trailer state of play reveal', '', {});
    const decisions = calculateImpactScore._lastDecisions || [];
    expect(decisions.some(d => /entertainment guard/i.test(d) || /no severity context/i.test(d))).toBe(true);
  });

  it('records boost decision in _lastDecisions for conflict headline', () => {
    calculateImpactScore('War: Iran missile kills dozens', '', { rankingWeights: { impact: { highImpactBoost: 2.5 } } });
    const decisions = calculateImpactScore._lastDecisions || [];
    expect(decisions.some(d => /high-impact keyword 'war'/i.test(d))).toBe(true);
  });
});

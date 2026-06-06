import { describe, expect, it } from 'vitest';
import { computeHealthScore } from './healthScore.js';

describe('computeHealthScore', () => {
  it('returns healthy with score 100 for empty input', () => {
    const result = computeHealthScore([]);
    expect(result.passed).toBe(true);
    expect(result.status).toBe('healthy');
    expect(result.score).toBe(100);
  });

  it('returns healthy when all SLOs pass', () => {
    const result = computeHealthScore([
      { passed: true, required: true, score: 100, reasons: [] },
      { passed: true, required: false, score: 95, reasons: [] },
    ]);
    expect(result.passed).toBe(true);
    expect(result.status).toBe('healthy');
  });

  it('marks status failed when a required SLO fails even if numeric score stays high', () => {
    const result = computeHealthScore([
      { passed: false, required: true, penalty: 10, reasons: ['required_failed'] },
    ]);

    expect(result.passed).toBe(false);
    expect(result.status).toBe('failed');
  });

  it('marks status failed when numeric score drops below 70', () => {
    const result = computeHealthScore([
      { passed: false, required: false, penalty: 40, reasons: ['big_penalty'] },
      { passed: false, required: false, penalty: 40, reasons: ['another_penalty'] },
    ]);

    expect(result.score).toBeLessThan(70);
    expect(result.status).toBe('failed');
    expect(result.passed).toBe(false);
  });

  it('marks status degraded when score is 70-84 with no required failures', () => {
    const result = computeHealthScore([
      { passed: false, required: false, penalty: 20, reasons: ['minor_penalty'] },
    ]);

    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.score).toBeLessThan(85);
    expect(result.status).toBe('degraded');
  });

  it('collects all failure reasons deduped', () => {
    const result = computeHealthScore([
      { passed: false, required: false, penalty: 10, reasons: ['reason_a', 'shared'] },
      { passed: false, required: false, penalty: 10, reasons: ['reason_b', 'shared'] },
    ]);

    expect(result.reasons).toContain('reason_a');
    expect(result.reasons).toContain('reason_b');
    expect(result.reasons).toContain('shared');
    expect(result.reasons.filter(r => r === 'shared')).toHaveLength(1);
  });

  it('uses per-SLO score average when scores are provided', () => {
    const result = computeHealthScore([
      { passed: true, required: false, score: 80 },
      { passed: true, required: false, score: 90 },
    ]);

    expect(result.score).toBe(85);
    expect(result.status).toBe('healthy');
  });

  it('score is clamped to 0–100', () => {
    const result = computeHealthScore([
      { passed: false, required: false, penalty: 999, reasons: ['extreme_fail'] },
    ]);

    expect(result.score).toBe(0);
  });
});

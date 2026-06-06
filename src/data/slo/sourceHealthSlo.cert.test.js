import { describe, expect, it } from 'vitest';
import { evaluateSourceHealthSlo } from './sourceHealthSlo.js';

const HEALTHY_SOURCES = [
  { id: 'bbc', status: 'ok', itemCount: 50 },
  { id: 'cnn', status: 'ok', itemCount: 30 },
  { id: 'reuters', status: 'healthy', itemCount: 20 },
];

describe('evaluateSourceHealthSlo', () => {
  it('passes for healthy source list', () => {
    const result = evaluateSourceHealthSlo({ sources: HEALTHY_SOURCES });
    expect(result.passed).toBe(true);
    expect(result.reasons).toHaveLength(0);
    expect(result.required).toBe(false);
  });

  it('fails when sources is empty', () => {
    const result = evaluateSourceHealthSlo({ sources: [] });
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('source_health_empty');
  });

  it('fails when sources is missing', () => {
    const result = evaluateSourceHealthSlo({});
    expect(result.passed).toBe(false);
  });

  it('passes but warns for silent sources (non-ok, zero items)', () => {
    const result = evaluateSourceHealthSlo({
      sources: [
        { id: 'bbc', status: 'ok', itemCount: 50 },
        { id: 'silent', status: 'warn', itemCount: 0 },
      ],
    });
    expect(result.passed).toBe(true);
    expect(result.warnings.some(w => w.includes('source_health_silent_sources'))).toBe(true);
  });

  it('warns about majority silent when more than 50% are silent', () => {
    const result = evaluateSourceHealthSlo({
      sources: [
        { id: 'a', status: 'warn', itemCount: 0 },
        { id: 'b', status: 'warn', itemCount: 0 },
        { id: 'c', status: 'ok', itemCount: 10 },
      ],
    });
    expect(result.passed).toBe(true);
    expect(result.warnings).toContain('source_health_majority_silent');
  });

  it('warns about stale feeds', () => {
    const result = evaluateSourceHealthSlo({
      sources: [
        { id: 'bbc', status: 'ok', itemCount: 50, stale: true },
        { id: 'cnn', status: 'ok', itemCount: 30 },
      ],
    });
    expect(result.passed).toBe(true);
    expect(result.warnings.some(w => w.includes('source_health_stale_feeds'))).toBe(true);
  });

  it('handles null input gracefully', () => {
    const result = evaluateSourceHealthSlo(null);
    expect(result.passed).toBe(false);
  });

  it('exposes metrics', () => {
    const result = evaluateSourceHealthSlo({ sources: HEALTHY_SOURCES });
    expect(result.metrics.sourceCount).toBe(3);
    expect(result.metrics.silentCount).toBe(0);
  });
});

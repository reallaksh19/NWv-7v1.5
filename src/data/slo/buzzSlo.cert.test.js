import { describe, expect, it } from 'vitest';
import { evaluateBuzzSlo } from './buzzSlo.js';

describe('buzzSlo', () => {
  it('fails empty buzz dataset', () => {
    const result = evaluateBuzzSlo({});

    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('buzz_empty');
  });

  it('passes mixed buzz content', () => {
    const result = evaluateBuzzSlo({
      entertainment: {
        tamil: [{ title: 'Tamil film' }],
        hindi: [{ title: 'Hindi film' }],
      },
      socialTrends: {
        india: [{ title: 'Trend' }],
        world: [{ title: 'Viral' }],
      },
      techCards: [{ title: 'Phone' }],
      aiCards: [{ title: 'OpenAI release' }],
      raw: {
        sourceDominance: {
          ratio: 0.2,
        },
      },
    });

    expect(result.passed).toBe(true);
    expect(result.metrics.total).toBe(6);
    expect(result.metrics.presentSurfaceCount).toBe(3);
  });

  it('warns when only one Buzz surface has content', () => {
    const result = evaluateBuzzSlo({
      entertainment: {
        tamil: [{ title: 'Tamil film' }],
      },
      socialTrends: {},
      techCards: [],
      aiCards: [],
    });

    expect(result.passed).toBe(true);
    expect(result.warnings).toContain('buzz_surface_diversity_low');
  });
});

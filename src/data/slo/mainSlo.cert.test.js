import { describe, expect, it } from 'vitest';
import { evaluateMainSlo } from './mainSlo.js';

describe('mainSlo', () => {
  it('fails when no visible home content exists', () => {
    const result = evaluateMainSlo({
      frontPage: [],
      quickWeather: null,
      marketSummary: null,
      upAheadSummary: null,
      insightSummary: { skipped: true },
      topline: [],
      adapterOnly: true,
    });

    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('main_no_visible_content');
    expect(result.reasons).toContain('main_insufficient_visible_modules');
  });

  it('fails one tiny module only', () => {
    const result = evaluateMainSlo({
      frontPage: [{ title: 'Only story' }],
      quickWeather: null,
      marketSummary: null,
      upAheadSummary: null,
      insightSummary: { skipped: true },
      topline: ['Only story'],
      adapterOnly: true,
    });

    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('main_insufficient_visible_modules');
  });

  it('fails when adapterOnly flag is missing', () => {
    const result = evaluateMainSlo({
      frontPage: Array.from({ length: 8 }, (_, i) => ({ title: `Story ${i}` })),
      quickWeather: { city: 'Chennai' },
      marketSummary: { primary: { name: 'NIFTY 50' } },
      upAheadSummary: { event: { title: 'Event' } },
      insightSummary: { skipped: true },
      topline: ['Story'],
    });

    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('main_adapter_only_flag_missing');
  });

  it('passes good front page and warns skipped insight', () => {
    const result = evaluateMainSlo({
      frontPage: Array.from({ length: 8 }, (_, i) => ({ title: `Story ${i}` })),
      quickWeather: { city: 'Chennai' },
      marketSummary: { primary: { name: 'NIFTY 50' } },
      upAheadSummary: { event: { title: 'Event' } },
      insightSummary: { skipped: true },
      topline: ['Story', 'Weather'],
      adapterOnly: true,
    });

    expect(result.passed).toBe(true);
    expect(result.warnings).toContain('main_insight_skipped_adapter_only');
  });

  it('passes two visible modules even when front page is small', () => {
    const result = evaluateMainSlo({
      frontPage: [],
      quickWeather: { city: 'Chennai' },
      marketSummary: { primary: { name: 'NIFTY 50' } },
      upAheadSummary: null,
      insightSummary: { skipped: true },
      topline: ['Weather', 'Market'],
      adapterOnly: true,
    });

    expect(result.passed).toBe(true);
    expect(result.metrics.visibleModuleCount).toBe(2);
  });
});

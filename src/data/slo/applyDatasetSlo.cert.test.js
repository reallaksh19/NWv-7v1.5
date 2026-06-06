import { describe, expect, it } from 'vitest';
import { makeEnvelope } from '../dataEnvelope.js';
import {
  applyDatasetSlo,
  __applyDatasetSloInternalsForTest,
} from './applyDatasetSlo.js';

describe('applyDatasetSlo', () => {
  it('adds SLO result to a known Release 5 dataset envelope', () => {
    const env = makeEnvelope({
      ok: true,
      datasetId: 'sections',
      data: {
        frontPage: [{ title: 'A' }, { title: 'B' }, { title: 'C' }, { title: 'D' }, { title: 'E' }],
        sectionCounts: {
          world: 3,
          india: 2,
          technology: 2,
        },
        sourceCounts: {
          A: 4,
          B: 3,
        },
      },
      validation: {
        passed: true,
        errors: [],
        warnings: [],
      },
    });

    const result = applyDatasetSlo(env);

    expect(result.slo?.id).toBe('sectionsSlo');
    expect(result.validation.passed).toBe(true);
    expect(result.diagnostics.some(d => d.event === 'sections.slo_evaluated')).toBe(true);
  });

  it('fails envelope when required SLO fails', () => {
    const env = makeEnvelope({
      ok: true,
      datasetId: 'main',
      data: {
        frontPage: [],
        quickWeather: null,
        marketSummary: null,
        upAheadSummary: null,
        insightSummary: { skipped: true },
        adapterOnly: true,
      },
      validation: {
        passed: true,
        errors: [],
        warnings: [],
      },
    });

    const result = applyDatasetSlo(env);

    expect(result.ok).toBe(false);
    expect(result.slo?.required).toBe(true);
    expect(result.validation.errors).toContain('main_insufficient_visible_modules');
  });

  it('keeps envelope ok when optional SLO fails', () => {
    const env = makeEnvelope({
      ok: true,
      datasetId: 'buzz',
      data: {},
      validation: {
        passed: true,
        errors: [],
        warnings: [],
      },
    });

    const result = applyDatasetSlo(env);

    expect(result.ok).toBe(true);
    expect(result.slo?.passed).toBe(false);
    expect(result.validation.warnings).toContain('buzz_empty');
  });

  it('returns unknown dataset envelope unchanged', () => {
    const env = makeEnvelope({
      ok: true,
      datasetId: 'weather',
      data: { ok: true },
    });

    const result = applyDatasetSlo(env);

    expect(result).toBe(env);
  });

  it('converts SLO evaluator errors into failed envelopes', () => {
    const env = makeEnvelope({
      ok: true,
      datasetId: 'main',
      data: null,
      validation: {
        passed: true,
        errors: [],
        warnings: [],
      },
    });

    const { makeSloEvaluationFailureEnvelope } = __applyDatasetSloInternalsForTest;
    const result = makeSloEvaluationFailureEnvelope(env, new Error('boom'));

    expect(result.ok).toBe(false);
    expect(result.validation.passed).toBe(false);
    expect(result.validation.errors).toContain('slo_evaluation_failed');
    expect(result.diagnostics.some(d => d.event === 'main.slo_evaluation_failed')).toBe(true);
  });
});

import {
  makeEnvelope,
  ENVELOPE_FRESHNESS,
} from '../dataEnvelope.js';
import { getDatasetSloEvaluator } from './index.js';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function mergeUnique(...lists) {
  return [...new Set(lists.flatMap(asArray).filter(Boolean))];
}

function getSloSeverity(slo) {
  if (!slo) return 'info';
  if (slo.passed === false && slo.required === true) return 'error';
  if (slo.passed === false) return 'warn';
  if (asArray(slo.warnings).length > 0) return 'warn';
  return 'info';
}

function shouldFailEnvelope(env, slo) {
  if (!slo) return env?.ok === false;
  if (slo.required === true && slo.passed === false) return true;
  return env?.ok === false;
}

function getFreshness(env, slo) {
  if (slo?.required === true && slo.passed === false) {
    return env?.freshness || ENVELOPE_FRESHNESS.UNKNOWN;
  }

  return env?.freshness;
}

function makeSloEvaluationFailureEnvelope(envelope, error) {
  const message = error?.message || String(error);
  const validation = envelope.validation || {};

  return makeEnvelope({
    ...envelope,
    ok: false,
    error: envelope.error || `SLO evaluation failed: ${message}`,
    validation: {
      ...validation,
      passed: false,
      errors: mergeUnique(validation.errors, ['slo_evaluation_failed']),
      warnings: asArray(validation.warnings),
    },
    diagnostics: [
      ...asArray(envelope.diagnostics),
      {
        event: `${envelope.datasetId}.slo_evaluation_failed`,
        severity: 'error',
        message,
      },
    ],
  });
}

export function applyDatasetSlo(envelope) {
  if (!envelope || typeof envelope !== 'object') {
    return envelope;
  }

  const evaluator = getDatasetSloEvaluator(envelope.datasetId);

  if (typeof evaluator !== 'function') {
    return envelope;
  }

  let slo;

  try {
    slo = evaluator(envelope);
  } catch (error) {
    return makeSloEvaluationFailureEnvelope(envelope, error);
  }

  const failEnvelope = shouldFailEnvelope(envelope, slo);
  const existingValidation = envelope.validation || {};
  const existingDiagnostics = asArray(envelope.diagnostics);

  const errors = mergeUnique(
    existingValidation.errors,
    failEnvelope && slo?.required === true ? slo.reasons : []
  );

  const warnings = mergeUnique(
    existingValidation.warnings,
    slo?.warnings,
    slo?.required !== true && slo?.passed === false ? slo.reasons : []
  );

  return makeEnvelope({
    ...envelope,
    ok: !failEnvelope,
    freshness: getFreshness(envelope, slo),
    error: failEnvelope
      ? envelope.error || asArray(slo?.reasons)[0] || `${envelope.datasetId} SLO failed`
      : envelope.error || null,
    validation: {
      ...existingValidation,
      passed: !failEnvelope && existingValidation.passed !== false,
      errors,
      warnings,
    },
    slo,
    diagnostics: [
      ...existingDiagnostics,
      {
        event: `${envelope.datasetId}.slo_evaluated`,
        severity: getSloSeverity(slo),
        message: `${slo?.id || envelope.datasetId} ${slo?.passed ? 'passed' : 'failed'}`,
        details: {
          required: slo?.required === true,
          score: slo?.score,
          reasons: asArray(slo?.reasons),
          warnings: asArray(slo?.warnings),
          metrics: slo?.metrics || {},
        },
      },
    ],
  });
}

export const __applyDatasetSloInternalsForTest = {
  asArray,
  mergeUnique,
  getSloSeverity,
  shouldFailEnvelope,
  makeSloEvaluationFailureEnvelope,
};

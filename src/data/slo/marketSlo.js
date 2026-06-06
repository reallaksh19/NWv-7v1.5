/**
 * Market dataset SLO evaluator.
 *
 * Checks:
 * - Indices array non-empty (required)
 * - fetchedAt is a valid finite number (required)
 * - source is one of the known valid values (required)
 * - No index has value <= 0 (required)
 * - No index has an impossible % change (|change%| > 20 is flagged as warning)
 */

const VALID_SOURCES = new Set(['live', 'snapshot', 'cache', 'seed', 'failed']);
const MAX_PLAUSIBLE_CHANGE_PCT = 20;

export function evaluateMarketSlo(marketData) {
  const reasons = [];
  const warnings = [];
  let score = 100;

  const indices = marketData?.indices;

  if (!Array.isArray(indices) || indices.length === 0) {
    reasons.push('market_indices_empty');
    score -= 60;
  } else {
    const badValues = indices.filter(idx => {
      const v = Number(idx?.value ?? idx?.price ?? idx?.close);
      return !Number.isFinite(v) || v <= 0;
    });

    if (badValues.length > 0) {
      reasons.push(`market_indices_invalid_value:${badValues.map(i => i.name || '?').join(',')}`);
      score -= Math.min(40, badValues.length * 10);
    }

    const extremeMoves = indices.filter(idx => {
      const pct = Number(idx?.changePercent ?? idx?.change_pct ?? idx?.pct ?? NaN);
      return Number.isFinite(pct) && Math.abs(pct) > MAX_PLAUSIBLE_CHANGE_PCT;
    });

    if (extremeMoves.length > 0) {
      warnings.push(`market_extreme_move:${extremeMoves.map(i => i.name || '?').join(',')}`);
    }
  }

  const fetchedAt = Number(marketData?.fetchedAt ?? marketData?.generatedAt ?? NaN);

  if (!Number.isFinite(fetchedAt) || fetchedAt <= 0) {
    reasons.push('market_invalid_timestamp');
    score -= 15;
  }

  const sourceMode = marketData?.sourceMode || marketData?.providerPlan?.mode || marketData?.sourceHealth?.mode;

  if (sourceMode && !VALID_SOURCES.has(String(sourceMode))) {
    reasons.push(`market_unknown_source_mode:${sourceMode}`);
    score -= 10;
  }

  const bounded = Math.max(0, Math.min(100, score));
  const passed = reasons.length === 0;

  return {
    id: 'marketSlo',
    required: true,
    passed,
    score: bounded,
    reasons,
    warnings,
    metrics: {
      indexCount: Array.isArray(indices) ? indices.length : 0,
      fetchedAt,
      sourceMode: sourceMode || null,
    },
  };
}

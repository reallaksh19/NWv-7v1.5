/**
 * Computes a composite health score from an array of SLO results.
 *
 * Rules:
 * - Each SLO result has { passed, required?, penalty?, reasons?, score? }.
 * - If any required SLO fails → status 'failed', passed: false (regardless of numeric score).
 * - score < 70 → status 'failed'.
 * - score 70–84 → status 'degraded'.
 * - score >= 85 → status 'healthy'.
 *
 * @param {Array<{passed: boolean, required?: boolean, penalty?: number, reasons?: string[], score?: number}>} sloResults
 * @returns {{ passed: boolean, score: number, status: 'healthy'|'degraded'|'failed', reasons: string[] }}
 */
export function computeHealthScore(sloResults = []) {
  if (!Array.isArray(sloResults) || sloResults.length === 0) {
    return {
      passed: true,
      score: 100,
      status: 'healthy',
      reasons: [],
    };
  }

  const normalized = sloResults.map(r => ({
    passed: r?.passed ?? true,
    required: r?.required ?? false,
    penalty: Number(r?.penalty ?? (r?.passed ? 0 : 20)),
    reasons: Array.isArray(r?.reasons) ? r.reasons : (r?.reasons ? [String(r.reasons)] : []),
    score: r?.score != null ? Number(r.score) : null,
  }));

  const reasons = normalized.flatMap(r => (r.passed ? [] : r.reasons));

  // Use per-SLO score if available, otherwise use penalty-based computation
  const hasScores = normalized.some(r => r.score !== null);

  let computedScore;

  if (hasScores) {
    // Average the individual SLO scores (all available)
    const scores = normalized.map(r => (r.score !== null ? r.score : (r.passed ? 100 : 0)));
    computedScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  } else {
    // Penalty-based: start at 100 and subtract per failed SLO
    const totalPenalty = normalized.reduce((sum, r) => sum + (r.passed ? 0 : r.penalty), 0);
    computedScore = 100 - totalPenalty;
  }

  const bounded = Math.max(0, Math.min(100, Math.round(computedScore)));

  // A required SLO failure always means failed — regardless of numeric score
  const hasRequiredFailure = normalized.some(r => r.required === true && r.passed === false);

  return {
    passed: bounded >= 70 && !hasRequiredFailure,
    score: bounded,
    status: hasRequiredFailure || bounded < 70
      ? 'failed'
      : bounded >= 85
        ? 'healthy'
        : 'degraded',
    reasons: [...new Set(reasons)],
  };
}

/**
 * Source health dataset SLO evaluator.
 *
 * Required: at least one source present (non-empty source array).
 * Warning: sources with zero items or non-ok status (not a hard failure).
 */

export function evaluateSourceHealthSlo(sourceHealthData) {
  const sources = sourceHealthData?.sources || [];
  const reasons = [];
  const warnings = [];
  let score = 100;

  if (!Array.isArray(sources) || sources.length === 0) {
    reasons.push('source_health_empty');
    score -= 60;
  } else {
    const silentSources = sources.filter(s => {
      const status = String(s?.status || '').toLowerCase();
      const itemCount = Number(s?.itemCount ?? 0);
      return status !== 'ok' && status !== 'healthy' && itemCount === 0;
    });

    if (silentSources.length > 0) {
      const pct = Math.round((silentSources.length / sources.length) * 100);
      warnings.push(`source_health_silent_sources:${pct}%`);

      if (pct >= 50) {
        warnings.push('source_health_majority_silent');
      }
    }

    const staleSources = sources.filter(s => {
      const flag = s?.stale || s?.isStale;
      return Boolean(flag);
    });

    if (staleSources.length > 0) {
      warnings.push(`source_health_stale_feeds:${staleSources.length}`);
    }
  }

  const bounded = Math.max(0, Math.min(100, score));
  const passed = reasons.length === 0;

  return {
    id: 'sourceHealthSlo',
    required: false,
    passed,
    score: bounded,
    reasons,
    warnings,
    metrics: {
      sourceCount: sources.length,
      silentCount: Array.isArray(sources)
        ? sources.filter(s => {
            const status = String(s?.status || '').toLowerCase();
            const itemCount = Number(s?.itemCount ?? 0);
            return status !== 'ok' && status !== 'healthy' && itemCount === 0;
          }).length
        : 0,
    },
  };
}

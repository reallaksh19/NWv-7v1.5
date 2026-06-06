export function evaluateInsightSlo(input = {}) {
  const data = input?.data || input || {};
  const quality = data.quality || {};

  const storyCount = Number(quality.storyCount || 0);
  const sourceGroupCount = Number(quality.sourceGroupCount || 0);
  const usableParentCount = Number(quality.usableParentCount || 0);

  const source = data.source || input.source || 'unknown';
  const staleLabel = data.staleLabel || null;
  const repairState = data.repairState || {};

  const reasons = [];
  const warnings = [];

  if (storyCount === 0) {
    reasons.push('insight_story_count_zero');
  }

  if (storyCount > 0 && storyCount < 100) {
    warnings.push('insight_story_count_below_target');
  }

  if (storyCount > 0 && sourceGroupCount < 4) {
    warnings.push('insight_source_group_count_below_target');
  }

  if (storyCount > 0 && usableParentCount < 3) {
    warnings.push('insight_usable_parent_count_below_target');
  }

  if (source === 'stale-snapshot') {
    warnings.push('insight_stale_snapshot');
  }

  if (repairState?.error) {
    warnings.push('insight_repair_state_error');
  }

  // Warn (not fail) when stories exist but clustering produced zero usable parents.
  // Raising this to reasons would cause envelope.ok=false when data is partially available.
  if (storyCount > 0 && usableParentCount === 0) {
    warnings.push('insight_no_usable_parents');
  }

  // Warn when the source itself was unavailable or explicitly failed.
  // storyCount will already be 0 in these cases (insight_story_count_zero fires above),
  // so this adds descriptive context without double-failing the SLO.
  if (source === 'unavailable' || source === 'failed') {
    warnings.push('insight_source_unavailable');
  }

  return {
    id: 'insightSlo',
    required: true,
    passed: reasons.length === 0,
    penalty: 45,
    score: reasons.length === 0
      ? Math.max(60, 100 - warnings.length * 5)
      : 0,
    reasons,
    warnings,
    metrics: {
      storyCount,
      sourceGroupCount,
      usableParentCount,
      source,
      hasStaleLabel: Boolean(staleLabel),
      repairStatePreserved: repairState?.preserved === true,
    },
  };
}

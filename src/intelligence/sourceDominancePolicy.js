/**
 * Source Dominance Policy
 *
 * Detects when a single source contributes more than threshold% of items in a
 * feed section. Audit-only by default; `apply()` is only called when
 * `settings.editorialPolicies.enabled === true`.
 *
 * Both functions are pure — no side effects, no I/O.
 */

const DEFAULT_DOMINANCE_THRESHOLD = 0.35; // 35 % of items from one source triggers a flag

function getSourceKey(item) {
  return String(item?.source || item?.sourceDomain || 'unknown')
    .toLowerCase()
    .trim();
}

/**
 * Audit items for source dominance without removing anything.
 *
 * @param {Array}  items    - Feed items after dedup/cluster
 * @param {Object} settings - App settings object
 * @returns {{ drops: Array<{id, reason}>, stats: Object }}
 */
export function audit(items = [], settings = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      drops: [],
      stats: { total: 0, sources: {}, dominantSource: null, dominantSources: [], threshold: DEFAULT_DOMINANCE_THRESHOLD },
    };
  }

  const threshold = settings?.editorialPolicies?.sourceDominanceThreshold ?? DEFAULT_DOMINANCE_THRESHOLD;
  const total = items.length;

  // Count items per source
  const sourceCounts = {};
  for (const item of items) {
    const key = getSourceKey(item);
    sourceCounts[key] = (sourceCounts[key] || 0) + 1;
  }

  // Identify over-represented sources
  const dominantSources = Object.entries(sourceCounts)
    .filter(([, count]) => count / total > threshold)
    .map(([source, count]) => ({ source, count, share: count / total }))
    .sort((a, b) => b.share - a.share);

  const drops = [];

  for (const { source, count, share } of dominantSources) {
    const allowedCount = Math.floor(total * threshold);
    const excessCount = count - allowedCount;

    // Mark the lowest-ranked excess items from this source as would-be drops
    // (iterating in reverse preserves high-ranked items when applied)
    let marked = 0;
    for (let i = items.length - 1; i >= 0 && marked < excessCount; i--) {
      if (getSourceKey(items[i]) === source) {
        drops.push({
          id: items[i].id,
          reason: `source_dominance:${source}:${(share * 100).toFixed(0)}%`,
        });
        marked++;
      }
    }
  }

  return {
    drops,
    stats: {
      total,
      sources: sourceCounts,
      dominantSource: dominantSources.length > 0 ? dominantSources[0].source : null,
      dominantSources,
      threshold,
    },
  };
}

/**
 * Apply source dominance policy — removes excess items from over-represented sources.
 * Only called when `settings.editorialPolicies.enabled === true`.
 *
 * @param {Array}  items
 * @param {Object} settings
 * @returns {Array} filtered items
 */
export function apply(items = [], settings = {}) {
  const { drops } = audit(items, settings);
  if (drops.length === 0) return items;

  const dropIds = new Set(drops.map(d => d.id));
  return items.filter(item => !dropIds.has(item.id));
}

export const __sourceDominancePolicyInternalsForTest = {
  DEFAULT_DOMINANCE_THRESHOLD,
  getSourceKey,
};

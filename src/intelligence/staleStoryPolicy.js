/**
 * Stale Story Policy
 *
 * Flags items whose `publishedAt` timestamp is older than `staleAgeMs`.
 * Audit-only by default; `apply()` is only called when
 * `settings.editorialPolicies.enabled === true`.
 *
 * Both functions are pure — no side effects, no I/O.
 */

const DEFAULT_STALE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Audit items for stale age without removing anything.
 *
 * @param {Array}  items    - Feed items after dedup/cluster
 * @param {Object} settings - App settings object
 * @param {number} [nowMs]  - Override for current time (testing)
 * @returns {{ drops: Array<{id, reason}>, stats: Object }}
 */
export function audit(items = [], settings = {}, nowMs = Date.now()) {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      drops: [],
      stats: { total: 0, staleCount: 0, freshCount: 0, staleAgeMs: DEFAULT_STALE_AGE_MS },
    };
  }

  const staleAgeMs = settings?.editorialPolicies?.staleAgeMs ?? DEFAULT_STALE_AGE_MS;
  const cutoff = nowMs - staleAgeMs;

  const drops = [];
  let staleCount = 0;
  let freshCount = 0;

  for (const item of items) {
    const publishedAt = Number(item?.publishedAt) || 0;
    if (publishedAt > 0 && publishedAt < cutoff) {
      const ageHours = Math.round((nowMs - publishedAt) / 3_600_000);
      drops.push({
        id: item.id,
        reason: `stale_story:age=${ageHours}h`,
      });
      staleCount++;
    } else {
      freshCount++;
    }
  }

  return {
    drops,
    stats: {
      total: items.length,
      staleCount,
      freshCount,
      staleAgeMs,
      cutoffTs: cutoff,
    },
  };
}

/**
 * Apply stale story policy — removes items older than staleAgeMs.
 * Only called when `settings.editorialPolicies.enabled === true`.
 *
 * @param {Array}  items
 * @param {Object} settings
 * @param {number} [nowMs]
 * @returns {Array} filtered items
 */
export function apply(items = [], settings = {}, nowMs = Date.now()) {
  const { drops } = audit(items, settings, nowMs);
  if (drops.length === 0) return items;

  const dropIds = new Set(drops.map(d => d.id));
  return items.filter(item => !dropIds.has(item.id));
}

export const __staleStoryPolicyInternalsForTest = {
  DEFAULT_STALE_AGE_MS,
};

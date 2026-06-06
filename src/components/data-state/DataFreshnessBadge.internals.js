export function getFreshnessLabel(freshness) {
  if (!freshness) return 'unknown';

  const normalized = String(freshness).toLowerCase();

  if (normalized === 'fresh') return 'fresh';
  if (normalized === 'stale') return 'stale';
  if (normalized === 'empty') return 'empty';
  if (normalized === 'unknown') return 'unknown';

  return normalized;
}

export function getFreshnessTone(freshness) {
  const normalized = String(freshness || '').toLowerCase();

  if (normalized === 'fresh') return 'positive';
  if (normalized === 'stale') return 'warning';
  if (normalized === 'empty') return 'muted';

  return 'neutral';
}

export const __dataFreshnessBadgeInternalsForTest = {
  getFreshnessLabel,
  getFreshnessTone,
};

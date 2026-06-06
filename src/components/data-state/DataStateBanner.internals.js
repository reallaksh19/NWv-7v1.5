export function getBannerTone({ envelope, error, loading }) {
  if (loading) return 'neutral';
  if (error || envelope?.ok === false) return 'danger';
  if (envelope?.fallbackUsed) return 'warning';
  if (envelope?.freshness === 'stale') return 'warning';
  if (envelope?.freshness === 'empty') return 'muted';

  return 'positive';
}

export function getBannerMessage({ envelope, error, loading, label = 'Data' }) {
  if (loading) return `${label} is loading…`;
  if (error) return `${label} failed to load.`;
  if (envelope?.ok === false) return envelope?.error || `${label} is degraded.`;
  if (envelope?.fallbackUsed) return `${label} is using fallback data.`;
  if (envelope?.freshness === 'stale') return `${label} may be stale.`;
  if (envelope?.freshness === 'empty') return `${label} has no visible items.`;

  return `${label} is ready.`;
}

export const __dataStateBannerInternalsForTest = {
  getBannerTone,
  getBannerMessage,
};

export function getSourceLabel(source, fallbackUsed = false) {
  if (fallbackUsed) return 'fallback';

  if (!source) return 'unknown';

  const normalized = String(source).toLowerCase();

  if (normalized === 'live') return 'live';
  if (normalized === 'snapshot') return 'snapshot';
  if (normalized === 'cache') return 'cache';
  if (normalized === 'seed') return 'seed';
  if (normalized === 'failed') return 'failed';

  return normalized;
}

export function getSourceTone(source, fallbackUsed = false) {
  if (fallbackUsed) return 'warning';

  const normalized = String(source || '').toLowerCase();

  if (normalized === 'live') return 'positive';
  if (normalized === 'snapshot') return 'neutral';
  if (normalized === 'cache') return 'warning';
  if (normalized === 'seed') return 'warning';
  if (normalized === 'failed') return 'danger';

  return 'neutral';
}

export const __dataSourceBadgeInternalsForTest = {
  getSourceLabel,
  getSourceTone,
};

export function normalizeScore(score) {
  const numeric = Number(score);

  if (!Number.isFinite(numeric)) return null;

  return Math.max(0, Math.min(100, Math.round(numeric)));
}

export function getSloTone(score, passed) {
  if (passed === false) return 'danger';

  const normalized = normalizeScore(score);

  if (normalized == null) return 'neutral';
  if (normalized >= 85) return 'positive';
  if (normalized >= 70) return 'warning';

  return 'danger';
}

export function getSloLabel(score, passed) {
  const normalized = normalizeScore(score);

  if (passed === false && normalized == null) return 'SLO failed';
  if (normalized == null) return 'SLO unknown';

  return `SLO ${normalized}`;
}

export const __dataSloBadgeInternalsForTest = {
  normalizeScore,
  getSloTone,
  getSloLabel,
};

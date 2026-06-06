function toValidDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toDateKey(value, fallback = 'undated') {
  const parsed = toValidDate(value);
  if (!parsed) return fallback;
  parsed.setHours(0, 0, 0, 0);
  return parsed.toISOString().slice(0, 10);
}

export function formatPlannerDateLabel(dateKey, fallback = 'Date TBD') {
  if (!dateKey || dateKey === 'undated') return fallback;
  const parsed = toValidDate(`${dateKey}T00:00:00Z`) || toValidDate(dateKey);
  if (!parsed) return fallback;
  return parsed.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });
}

export function formatPlannerCompactDateLabel(dateKey, fallback = 'Date TBD') {
  if (!dateKey || dateKey === 'undated') return fallback;
  const parsed = toValidDate(`${dateKey}T00:00:00Z`) || toValidDate(dateKey);
  if (!parsed) return fallback;
  return parsed.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

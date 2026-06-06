export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function formatTimestamp(value) {
  if (!value) return null;

  const numeric = Number(value);
  const date = Number.isFinite(numeric)
    ? new Date(numeric)
    : new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getWarningCount(envelope) {
  return [
    ...asArray(envelope?.validation?.warnings),
    ...asArray(envelope?.slo?.warnings),
  ].length;
}

export function getWarningMessages(envelope) {
  return [
    ...asArray(envelope?.validation?.warnings),
    ...asArray(envelope?.slo?.warnings),
  ];
}

export const __dataStateMetaInternalsForTest = {
  asArray,
  formatTimestamp,
  getWarningCount,
};

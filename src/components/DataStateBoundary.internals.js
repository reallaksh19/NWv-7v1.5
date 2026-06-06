export function hasRenderableValue(value, depth = 0) {
  if (value == null) return false;
  if (depth > 3) return true;

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value);

    if (entries.length === 0) return false;

    return entries.some(([key, nested]) => {
      if (['raw', 'metrics', 'diagnostics', 'validation', 'slo'].includes(key)) {
        return false;
      }

      return hasRenderableValue(nested, depth + 1);
    });
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  return true;
}

export function hasRenderableData(envelope) {
  return hasRenderableValue(envelope?.data);
}

export function getBoundaryState({
  envelope,
  loading,
  error,
  allowDegraded,
  treatEmptyAsReady,
}) {
  if (loading && !envelope) return 'loading';
  if (error && !envelope) return 'error';
  if (!envelope) return 'empty';

  if (envelope.ok === false) {
    if (allowDegraded && hasRenderableData(envelope)) return 'degraded';
    return 'error';
  }

  if (envelope.freshness === 'empty' && !treatEmptyAsReady) {
    return 'empty';
  }

  if (!hasRenderableData(envelope) && !treatEmptyAsReady) {
    return 'empty';
  }

  if (loading && envelope) return 'refreshing';

  return 'ready';
}

export const __dataStateBoundaryInternalsForTest = {
  hasRenderableValue,
  hasRenderableData,
  getBoundaryState,
};

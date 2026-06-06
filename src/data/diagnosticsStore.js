const MAX_DIAGNOSTICS = 500;

let diagnostics = [];
const listeners = new Set();

function emit() {
  const snapshot = diagnostics.slice();

  listeners.forEach(listener => {
    try {
      listener(snapshot);
    } catch (error) {
      console.warn('[diagnosticsStore] listener failed', error);
    }
  });
}

export function recordDiagnostic(event = {}) {
  const normalized = {
    id: event.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    ts: event.ts || Date.now(),
    severity: event.severity || 'info',
    datasetId: event.datasetId || 'unknown',
    event: event.event || 'diagnostic',
    message: event.message || '',
    details: event.details || null,
  };

  diagnostics = [...diagnostics, normalized].slice(-MAX_DIAGNOSTICS);
  emit();

  return normalized;
}

export function listDiagnostics() {
  return diagnostics.slice();
}

export function clearDiagnostics() {
  diagnostics = [];
  emit();
}

export function subscribeDiagnostics(listener) {
  if (typeof listener !== 'function') {
    return () => {};
  }

  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function __getMaxDiagnosticsForTest() {
  return MAX_DIAGNOSTICS;
}

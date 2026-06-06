export const ENVELOPE_SOURCES = Object.freeze({
  LIVE: 'live',
  SNAPSHOT: 'snapshot',
  CACHE: 'cache',
  SEED: 'seed',
  FAILED: 'failed',
});

export const ENVELOPE_FRESHNESS = Object.freeze({
  FRESH: 'fresh',
  STALE: 'stale',
  EXPIRED: 'expired',
  EMPTY: 'empty',
  UNKNOWN: 'unknown',
});

export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  return `{${Object.keys(value)
    .sort()
    .map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

export function fnv1aHex(input) {
  const text = String(input ?? '');
  let hash = 0x811c9dc5;

  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }

  return hash.toString(16).padStart(8, '0');
}

export function makeEnvelope(partial = {}) {
  const now = Date.now();
  const ok = partial.ok ?? true;
  const data = partial.data ?? null;
  const source = partial.source || ENVELOPE_SOURCES.LIVE;

  return Object.freeze({
    ok,
    datasetId: partial.datasetId || 'unknown',
    data,
    payloadHash: partial.payloadHash || fnv1aHex(stableStringify(data)),
    source,
    freshness: partial.freshness || ENVELOPE_FRESHNESS.FRESH,
    generatedAt: partial.generatedAt ?? null,
    fetchedAt: partial.fetchedAt ?? now,
    lastGoodAt: partial.lastGoodAt ?? (ok ? now : null),
    schemaVersion: partial.schemaVersion || '1.0.0',
    fallbackUsed: source !== ENVELOPE_SOURCES.LIVE,
    validation: partial.validation || { passed: true, errors: [], warnings: [] },
    slo: partial.slo || { passed: true, score: 100, reasons: [] },
    diagnostics: partial.diagnostics || [],
    error: partial.error ?? null,
  });
}

export function isUsableEnvelope(env) {
  return Boolean(env && env.ok === true && env.data != null);
}

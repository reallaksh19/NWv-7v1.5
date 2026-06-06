import {
  makeEnvelope,
  ENVELOPE_SOURCES,
  ENVELOPE_FRESHNESS,
} from '../dataEnvelope.js';
import { fetchAllMarketData } from '../../services/indianMarketStableService.js';
import { evaluateMarketSlo } from '../slo/marketSlo.js';
import {
  getMarketPayloadAgeMs,
  isMarketPayloadDisplayable,
  isMarketPayloadFresh,
  MARKET_SERVICE_CACHE_TTL_MS,
} from '../../services/marketTrust.js';

function normalizeMarketSource(sourceMode) {
  if (!sourceMode) return ENVELOPE_SOURCES.LIVE;

  if (sourceMode === 'seed') return ENVELOPE_SOURCES.SEED;
  if (sourceMode === 'cache' || sourceMode === 'stale-cache') return ENVELOPE_SOURCES.CACHE;
  if (sourceMode === 'snapshot' || sourceMode === 'stale-snapshot') return ENVELOPE_SOURCES.SNAPSHOT;

  return ENVELOPE_SOURCES.LIVE;
}

function getMarketSourceMode(data) {
  return (
    data?.sourceMode ||
    data?.providerPlan?.mode ||
    data?.sourceHealth?.mode ||
    'live'
  );
}

function getMarketTimestamp(data) {
  const numericFetchedAt = Number(data?.fetchedAt);

  if (Number.isFinite(numericFetchedAt) && numericFetchedAt > 0) {
    return numericFetchedAt;
  }

  const generatedAt = Date.parse(data?.generatedAt || data?.generated_at || '');

  if (Number.isFinite(generatedAt) && generatedAt > 0) {
    return generatedAt;
  }

  return Date.now();
}

export async function load() {
  try {
    const data = await fetchAllMarketData();
    const timestamp = getMarketTimestamp(data);
    const sourceMode = getMarketSourceMode(data);
    const payload = { ...data, fetchedAt: timestamp, sourceMode };
    const slo = evaluateMarketSlo(payload);
    const displayable = isMarketPayloadDisplayable(payload);
    const stale = displayable && !isMarketPayloadFresh(payload, MARKET_SERVICE_CACHE_TTL_MS);
    const ok = displayable;
    const staleAgeHours = Math.max(1, Math.round(getMarketPayloadAgeMs(payload) / 3600000));
    const warnings = [
      ...(slo.warnings || []),
      stale ? `market_stale_data:${staleAgeHours}h` : null,
    ].filter(Boolean);
    const requiredAwareSlo = {
      ...slo,
      required: false,
      passed: ok,
      warnings,
      metrics: {
        ...(slo.metrics || {}),
        ageMs: getMarketPayloadAgeMs(payload),
        displayable,
        stale,
      },
    };

    return makeEnvelope({
      ok,
      datasetId: 'market',
      data,
      source: normalizeMarketSource(sourceMode),
      freshness: ok
        ? (stale ? ENVELOPE_FRESHNESS.STALE : ENVELOPE_FRESHNESS.FRESH)
        : ENVELOPE_FRESHNESS.EMPTY,
      generatedAt: timestamp,
      fetchedAt: Number(data?.fetchedAt || timestamp) || timestamp,
      validation: {
        passed: ok,
        errors: ok ? [] : (slo.reasons || []),
        warnings,
      },
      slo: requiredAwareSlo,
      diagnostics: [
        {
          event: ok ? 'market_dataset_loaded' : 'market_indices_empty',
          severity: stale ? 'warn' : (ok ? 'info' : 'warn'),
          message: ok
            ? `${data?.indices?.length ?? 0} market index row(s) loaded`
            : 'Market indices are empty or invalid',
          details: { sourceMode, stale },
        },
        {
          event: ok ? 'market_slo_degraded_or_passed' : 'market_slo_failed',
          severity: ok && !stale ? 'info' : 'warn',
          message: ok
            ? 'Market dataset is displayable'
            : 'Market dataset failed displayability checks',
          details: {
            sourceMode,
            score: requiredAwareSlo.score,
            reasons: requiredAwareSlo.reasons,
            warnings: requiredAwareSlo.warnings,
          },
        },
      ],
    });
  } catch (error) {
    const message = error?.message || String(error);

    return makeEnvelope({
      ok: false,
      datasetId: 'market',
      data: null,
      source: ENVELOPE_SOURCES.FAILED,
      freshness: ENVELOPE_FRESHNESS.UNKNOWN,
      error: message,
      validation: {
        passed: false,
        errors: [message],
        warnings: [],
      },
      diagnostics: [
        {
          event: 'market_dataset_failed',
          severity: 'error',
          message,
        },
      ],
    });
  }
}

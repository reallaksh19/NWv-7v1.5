import {
  makeEnvelope,
  ENVELOPE_SOURCES,
  ENVELOPE_FRESHNESS,
} from '../dataEnvelope.js';
import { fetchJson, publicDataUrl } from '../fetchClient.js';

const SOURCE_HEALTH_CANDIDATES = [
  'newsdata/source_health.json',
  'newsdata/source-health.json',
  'newsdata/quality_dashboard.json',
];

function toSourceArray(raw) {
  if (!raw) return [];

  if (Array.isArray(raw.sources)) return raw.sources;
  if (Array.isArray(raw.sourceHealth)) return raw.sourceHealth;
  if (Array.isArray(raw.latest?.sources)) return raw.latest.sources;
  if (Array.isArray(raw.latest?.sourceHealth)) return raw.latest.sourceHealth;

  const objectShape =
    raw.sourceHealth ||
    raw.latest?.sourceHealth ||
    raw.sources ||
    raw.latest?.sources;

  if (objectShape && typeof objectShape === 'object') {
    return Object.entries(objectShape).map(([id, value]) => ({
      id,
      ...(typeof value === 'object' && value !== null
        ? value
        : { status: String(value) }),
    }));
  }

  return [];
}

function normalizeSource(source, index) {
  const id = String(source?.id || source?.key || source?.name || `source-${index}`);

  const status = String(
    source?.status ||
    source?.health ||
    source?.state ||
    (Number(source?.itemCount || source?.count || 0) > 0 ? 'ok' : 'unknown')
  );

  const itemCount = Number(source?.itemCount ?? source?.count ?? source?.items ?? 0);

  const severity =
    source?.severity ||
    (status === 'ok' || status === 'healthy' ? 'info' : 'warn');

  return {
    id,
    name: String(source?.name || source?.label || id),
    status,
    itemCount: Number.isFinite(itemCount) ? itemCount : 0,
    lastSuccessAt: source?.lastSuccessAt || source?.last_success_at || source?.lastOkAt || null,
    lastItemAt: source?.lastItemAt || source?.last_item_at || source?.latestItemAt || null,
    message: source?.message || source?.reason || '',
    severity,
  };
}

function normalizeSourceHealth(raw) {
  const sources = toSourceArray(raw).map(normalizeSource);

  return {
    sources,
    raw,
  };
}

export async function load() {
  const attempts = [];

  for (const path of SOURCE_HEALTH_CANDIDATES) {
    const env = await fetchJson(publicDataUrl(path), {
      datasetId: `sourceHealth:${path}`,
      source: ENVELOPE_SOURCES.SNAPSHOT,
    });

    attempts.push(env);

    if (env.ok) {
      const normalized = normalizeSourceHealth(env.data);

      if (normalized.sources.length > 0) {
        return makeEnvelope({
          ok: true,
          datasetId: 'sourceHealth',
          data: normalized,
          source: ENVELOPE_SOURCES.SNAPSHOT,
          freshness: ENVELOPE_FRESHNESS.FRESH,
          generatedAt: env.generatedAt,
          fetchedAt: env.fetchedAt,
          validation: {
            passed: true,
            errors: [],
            warnings: [],
          },
          diagnostics: [
            ...env.diagnostics,
            {
              event: 'source_health_loaded',
              severity: 'info',
              message: `${normalized.sources.length} source health row(s) normalized`,
              details: { path },
            },
          ],
        });
      }

      if (path === 'newsdata/quality_dashboard.json') {
        attempts.push(makeEnvelope({
          ok: false,
          datasetId: 'sourceHealth:qualityDashboardNoSourceHealth',
          data: null,
          source: ENVELOPE_SOURCES.SNAPSHOT,
          freshness: ENVELOPE_FRESHNESS.UNKNOWN,
          error: 'quality_dashboard_loaded_but_no_source_health',
          diagnostics: [
            {
              event: 'quality_dashboard_loaded_but_no_source_health',
              severity: 'warn',
              message: 'quality_dashboard.json loaded but did not contain usable source health',
              details: { path },
            },
          ],
          validation: {
            passed: false,
            errors: ['quality_dashboard_loaded_but_no_source_health'],
            warnings: [],
          },
        }));
      }
    }
  }

  return makeEnvelope({
    ok: false,
    datasetId: 'sourceHealth',
    data: {
      sources: [],
      raw: null,
    },
    source: ENVELOPE_SOURCES.FAILED,
    freshness: ENVELOPE_FRESHNESS.UNKNOWN,
    error: 'source health unavailable',
    validation: {
      passed: false,
      errors: ['source health unavailable'],
      warnings: [],
    },
    diagnostics: [
      ...attempts.flatMap(env => env.diagnostics || []),
      {
        event: 'source_health_unavailable',
        severity: 'warn',
        message: 'No usable source health file found',
        details: {
          candidates: SOURCE_HEALTH_CANDIDATES,
        },
      },
    ],
  });
}

export const __sourceHealthInternalsForTest = {
  normalizeSourceHealth,
};

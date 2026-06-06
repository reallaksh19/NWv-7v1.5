import {
  makeEnvelope,
  ENVELOPE_SOURCES,
  ENVELOPE_FRESHNESS,
} from '../dataEnvelope.js';
import { applyDatasetSlo } from '../slo/applyDatasetSlo.js';
import { load as loadSections } from './sectionsDataset.js';
import { load as loadWeather } from './weatherDataset.js';
import { load as loadMarket } from './marketDataset.js';
import { load as loadUpAhead } from './upAheadDataset.js';
import { load as loadInsight } from './insightDataset.js';

// Release 5A adapter-only dataset.
// Do not consume from MainPage until Release 5H.
// Insight is expensive and is not loaded by default.

function settledValue(result) {
  return result.status === 'fulfilled' ? result.value : null;
}

function firstStory(items = []) {
  return Array.isArray(items) && items.length > 0 ? items[0] : null;
}

function getQuickWeather(weatherEnv) {
  const weatherData = weatherEnv?.data?.weatherData || {};
  const city = weatherEnv?.data?.usableCities?.[0] || Object.keys(weatherData)[0];

  if (!city) return null;

  return {
    city,
    current: weatherData[city],
  };
}

function getMarketSummary(marketEnv) {
  const indices = marketEnv?.data?.indices || [];
  const primary = indices[0] || null;

  return {
    primary,
    indexCount: indices.length,
    sourceMode: marketEnv?.data?.sourceMode || marketEnv?.source || null,
  };
}

function getUpAheadSummary(upAheadEnv) {
  return {
    alert: firstStory(upAheadEnv?.data?.combinedAlerts),
    event: firstStory(upAheadEnv?.data?.events),
    offer: firstStory(upAheadEnv?.data?.offers),
    release: firstStory(upAheadEnv?.data?.releases),
    sourceMode: upAheadEnv?.data?.sourceMode || null,
  };
}

function getInsightSummary(insightEnv) {
  const quality = insightEnv?.data?.quality || {};

  return {
    storyCount: quality.storyCount || 0,
    sourceGroupCount: quality.sourceGroupCount || 0,
    staleLabel: insightEnv?.data?.staleLabel || null,
    source: insightEnv?.data?.source || insightEnv?.source || null,
    skipped: !insightEnv,
  };
}

function buildTopline(sectionsEnv, weatherEnv, marketEnv, upAheadEnv, insightEnv) {
  const frontPage = sectionsEnv?.data?.frontPage || [];
  const quickWeather = getQuickWeather(weatherEnv);
  const marketSummary = getMarketSummary(marketEnv);
  const upAheadSummary = getUpAheadSummary(upAheadEnv);
  const insightSummary = getInsightSummary(insightEnv);

  return [
    frontPage[0]?.title || frontPage[0]?.headline || null,
    quickWeather?.city ? `Weather ready for ${quickWeather.city}` : null,
    marketSummary?.primary?.name ? `${marketSummary.primary.name}: ${marketSummary.primary.value}` : null,
    upAheadSummary?.alert?.title || upAheadSummary?.event?.title || null,
    insightSummary.storyCount ? `${insightSummary.storyCount} insight stories analysed` : null,
  ].filter(Boolean).slice(0, 5);
}

function collectInputWarnings(...envelopes) {
  return envelopes.flatMap(env => (
    Array.isArray(env?.validation?.warnings) ? env.validation.warnings : []
  ));
}

function hasStaleInput(...envelopes) {
  return envelopes.some(env => env?.freshness === ENVELOPE_FRESHNESS.STALE);
}

export async function load(options = {}) {
  const includeInsight = options.includeInsight === true;

  const results = await Promise.allSettled([
    loadSections({ frontPageLimit: 30, maxSections: 6 }),
    loadWeather(),
    loadMarket(),
    loadUpAhead(),
    includeInsight ? loadInsight() : Promise.resolve(null),
  ]);

  const [sectionsEnv, weatherEnv, marketEnv, upAheadEnv, insightEnv] = results.map(settledValue);

  const frontPage = sectionsEnv?.data?.frontPage || [];
  const quickWeather = getQuickWeather(weatherEnv);
  const marketSummary = getMarketSummary(marketEnv);
  const upAheadSummary = getUpAheadSummary(upAheadEnv);
  const insightSummary = getInsightSummary(insightEnv);
  const topline = buildTopline(sectionsEnv, weatherEnv, marketEnv, upAheadEnv, insightEnv);

  const travelPriority = {
    weather: quickWeather,
    upAhead: upAheadSummary,
  };

  const onThisDay = null;

  const warnings = [
    !sectionsEnv?.ok ? 'main_sections_unavailable' : null,
    weatherEnv && !weatherEnv.ok ? 'main_weather_degraded' : null,
    marketEnv && !marketEnv.ok ? 'main_market_degraded' : null,
    upAheadEnv && !upAheadEnv.ok ? 'main_upAhead_degraded' : null,
    includeInsight && insightEnv && !insightEnv.ok ? 'main_insight_degraded' : null,
    !includeInsight ? 'main_insight_skipped_adapter_only' : null,
    ...collectInputWarnings(weatherEnv, marketEnv),
  ].filter(Boolean);

  const ok = frontPage.length > 0 || Boolean(quickWeather || marketSummary?.primary || upAheadSummary?.event);
  const stale = ok && hasStaleInput(weatherEnv, marketEnv);

  const envelope = makeEnvelope({
    ok,
    datasetId: 'main',
    data: {
      frontPage,
      quickWeather,
      marketSummary,
      upAheadSummary,
      insightSummary,
      topline,
      travelPriority,
      onThisDay,
      adapterOnly: true,
      raw: {
        sections: sectionsEnv,
        weather: weatherEnv,
        market: marketEnv,
        upAhead: upAheadEnv,
        insight: insightEnv,
      },
    },
    source: ENVELOPE_SOURCES.LIVE,
    freshness: ok
      ? (stale ? ENVELOPE_FRESHNESS.STALE : ENVELOPE_FRESHNESS.FRESH)
      : ENVELOPE_FRESHNESS.EMPTY,
    error: ok ? null : 'main dataset unavailable',
    validation: {
      passed: ok,
      errors: ok ? [] : ['main_dataset_unavailable'],
      warnings,
    },
    diagnostics: [
      ...results.map((result, index) => ({
        event: result.status === 'fulfilled' ? 'mainDataset.input_loaded' : 'mainDataset.input_failed',
        severity: result.status === 'fulfilled' && (result.value === null || result.value?.ok) ? 'info' : 'warn',
        message: result.status === 'fulfilled'
          ? `Input ${index} loaded`
          : (result.reason?.message || String(result.reason)),
        details: {
          index,
          datasetId: result.status === 'fulfilled' ? result.value?.datasetId || null : null,
          ok: result.status === 'fulfilled' ? result.value?.ok ?? true : false,
        },
      })),
      {
        event: 'mainDataset.adapter_only',
        severity: 'info',
        message: 'Release 5A main dataset is adapter-only and must not be consumed by MainPage until Release 5H',
        details: {
          includeInsight,
        },
      },
    ],
  });

  return applyDatasetSlo(envelope);
}

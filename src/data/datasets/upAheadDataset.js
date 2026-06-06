import {
  makeEnvelope,
  ENVELOPE_SOURCES,
  ENVELOPE_FRESHNESS,
} from '../dataEnvelope.js';
import { applyDatasetSlo } from '../slo/applyDatasetSlo.js';
import {
  fetchStaticUpAheadData,
  fetchLiveUpAheadData,
  mergeUpAheadData,
  loadFromCache,
  saveToCache,
  isActualWeatherAlertText,
  isActualOfferText,
} from '../../services/upAheadService.js';
import { getUpAheadEvidence } from '../../services/upAheadEvidence.js';
import { getUpAheadBriefing } from '../../services/upAheadBriefing.js';
import { getRuntimeCapabilities } from '../../runtime/runtimeCapabilities.js';
import { getSettings } from '../../utils/storage.js';
import plannerStorage from '../../utils/plannerStorage.js';

const OFFER_MAX_AGE_MS      = 2  * 24 * 60 * 60 * 1000; // 2 days
const WEATHER_ALERT_MAX_AGE_MS = 36 * 60 * 60 * 1000;    // 36 hours — forecasts become stale quickly
const ALERT_MAX_AGE_MS      = 48 * 60 * 60 * 1000;       // 48 hours — general alerts
const CIVIC_MAX_AGE_MS      = 7  * 24 * 60 * 60 * 1000;  // 7 days — road/civic notices

function safeGetSettings() {
  try {
    return getSettings?.() || {};
  } catch {
    return {};
  }
}

function hasVisibleUpAheadContent(data) {
  if (!data) return false;
  if (Array.isArray(data.timeline) && data.timeline.some(day => (day?.items || []).length > 0)) return true;
  if (data.sections && Object.values(data.sections).some(items => Array.isArray(items) && items.length > 0)) return true;
  if (Array.isArray(data.weekly_plan) && data.weekly_plan.some(day => (day?.items || []).length > 0)) return true;
  return false;
}

function getSource(sourceMode) {
  if (sourceMode === 'cache') return ENVELOPE_SOURCES.CACHE;
  if (sourceMode === 'snapshot' || sourceMode === 'static') return ENVELOPE_SOURCES.SNAPSHOT;
  return ENVELOPE_SOURCES.LIVE;
}

function getItemAgeMs(item) {
  const raw = item?.publishedAt || item?.eventStartAt || item?.date || item?.timestamp;
  if (!raw) return 0;
  const ms = typeof raw === 'number'
    ? (raw < 10_000_000_000 ? raw * 1000 : raw)
    : Date.parse(raw);
  return Number.isFinite(ms) && ms > 0 ? Date.now() - ms : 0;
}

function buildVisible(data, settings) {
  const sections = data?.sections || {};

  const weatherAlerts = (sections.weather_alerts || []).filter(item => {
    if (!isActualWeatherAlertText(`${item?.title || ''} ${item?.description || ''}`, settings.upAhead)) return false;
    const age = getItemAgeMs(item);
    // Drop stale weather alerts — a 3-day-old rain warning is actively misleading
    if (age > 0 && age > WEATHER_ALERT_MAX_AGE_MS) return false;
    return true;
  });

  const alerts = [
    ...weatherAlerts,
    ...(sections.alerts || []).filter(item => {
      const age = getItemAgeMs(item);
      return age === 0 || age <= ALERT_MAX_AGE_MS;
    }),
  ];

  const civics = (sections.civic || []).filter(item => {
    const age = getItemAgeMs(item);
    return age === 0 || age <= CIVIC_MAX_AGE_MS;
  });

  const combinedAlerts = [
    ...alerts,
    ...civics,
  ];

  const offers = [
    ...(sections.shopping || []),
    ...(sections.airlines || []),
  ].filter(item => {
    if (!isActualOfferText(`${item?.title || ''} ${item?.description || ''}`, settings.upAhead)) return false;

    const pub = item?.publishedAt || item?.eventStartAt;
    if (pub && (Date.now() - pub) > OFFER_MAX_AGE_MS) return false;

    return true;
  });

  const releases = sections.movies || [];
  const events = sections.events || [];
  const festivals = sections.festivals || [];

  return {
    plan: data?.weekly_plan || [],
    offers,
    releases,
    events,
    alerts,
    weatherAlerts,
    combinedAlerts,
    festivals,
    civics,
  };
}

async function loadPlannerSyncIfAllowed() {
  const { isStaticHost } = getRuntimeCapabilities();

  if (isStaticHost) return;

  await Promise.allSettled([
    plannerStorage.loadBlacklistFromApi?.(),
    plannerStorage.loadPlanFromApi?.(),
  ]);
}

export async function load(options = {}) {
  const settings = safeGetSettings();

  const upAheadSettings = settings.upAhead || {
    categories: {
      movies: true,
      events: true,
      festivals: true,
      alerts: true,
      sports: true,
      shopping: true,
      civic: true,
      weather_alerts: true,
      airlines: true,
    },
    locations: ['Chennai'],
  };

  const diagnostics = [];
  let data = null;
  let sourceMode = 'live';

  await loadPlannerSyncIfAllowed();

  if (!options.forceRefresh && !options.liveOnly) {
    const cached = loadFromCache();

    if (cached) {
      data = cached;
      sourceMode = cached.sourceMode || 'cache';

      diagnostics.push({
        event: 'upAheadDataset.cache_hit',
        severity: 'info',
        message: 'Loaded Up Ahead cache',
      });
    }
  }

  if (!options.liveOnly) {
    try {
      const staticData = await fetchStaticUpAheadData(upAheadSettings);

      if (staticData && hasVisibleUpAheadContent(staticData)) {
        data = mergeUpAheadData(data, staticData);
        sourceMode = staticData.sourceMode || 'snapshot';
        saveToCache(data);

        diagnostics.push({
          event: 'upAheadDataset.static_loaded',
          severity: 'info',
          message: 'Merged static Up Ahead data',
        });
      } else {
        diagnostics.push({
          event: 'upAheadDataset.static_empty',
          severity: 'warn',
          message: 'Static Up Ahead data was empty or not displayable',
        });
      }
    } catch (error) {
      diagnostics.push({
        event: 'upAheadDataset.static_failed',
        severity: 'warn',
        message: error?.message || String(error),
      });
    }
  }

  try {
    const liveData = await fetchLiveUpAheadData(upAheadSettings);

    if (liveData && hasVisibleUpAheadContent(liveData)) {
      data = mergeUpAheadData(options.liveOnly ? null : data, liveData);
      sourceMode = liveData?.sourceMode || 'live';
      saveToCache(data);

      diagnostics.push({
        event: 'upAheadDataset.live_loaded',
        severity: 'info',
        message: 'Merged live Up Ahead data',
      });
    } else {
      diagnostics.push({
        event: 'upAheadDataset.live_empty',
        severity: data ? 'warn' : 'error',
        message: 'Live Up Ahead fetch returned no visible content',
      });
    }
  } catch (error) {
    diagnostics.push({
      event: 'upAheadDataset.live_failed',
      severity: data ? 'warn' : 'error',
      message: error?.message || String(error),
    });
  }

  const visible = buildVisible(data, settings);

  const evidence = getUpAheadEvidence({
    data,
    settings,
    visible: {
      weatherAlerts: visible.weatherAlerts,
      combinedAlerts: visible.combinedAlerts,
      offerItems: visible.offers,
      movieCards: visible.releases,
      festivalCards: visible.festivals,
    },
  });

  const briefing = getUpAheadBriefing({
    data,
    settings,
    visible: {
      weatherAlerts: visible.weatherAlerts,
      combinedAlerts: visible.combinedAlerts,
      offerItems: visible.offers,
      movieCards: visible.releases,
      festivalCards: visible.festivals,
    },
  });

  const ok = hasVisibleUpAheadContent(data);

  const envelope = makeEnvelope({
    ok,
    datasetId: 'upAhead',
    data: {
      ...visible,
      briefing,
      evidence,
      sourceMode,
      raw: data,
    },
    source: getSource(sourceMode),
    freshness: ok ? ENVELOPE_FRESHNESS.FRESH : ENVELOPE_FRESHNESS.EMPTY,
    error: ok ? null : 'up ahead unavailable',
    validation: {
      passed: ok,
      errors: ok ? [] : ['up_ahead_unavailable'],
      warnings: diagnostics
        .filter(item => item.severity === 'warn')
        .map(item => item.event),
    },
    diagnostics,
  });

  return applyDatasetSlo(envelope);
}

export const __upAheadDatasetInternalsForTest = {
  hasVisibleUpAheadContent,
  buildVisible,
};

import { useCallback, useMemo } from 'react';
import { useDataset } from '../data/orchestrator/useDataset.js';
import { useSettings } from '../context/SettingsContext';
import plannerStorage, {
  getPlannerStorageError,
  isPlannerStorageSuccess,
} from '../utils/plannerStorage';
import { getRuntimeCapabilities } from '../runtime/runtimeCapabilities';

function toLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function normalizePlanDate(dateStr) {
  if (!dateStr) return toLocalDateKey(new Date());

  if (/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr))) {
    return String(dateStr);
  }

  const parsed = new Date(dateStr);

  if (!Number.isNaN(parsed.getTime())) {
    return toLocalDateKey(parsed);
  }

  return dateStr;
}

function formatConciseDate(dateStr, publishedAt) {
  if (!dateStr) {
    // Fall back to relative time from publishedAt instead of 'Coming Soon'
    if (publishedAt) {
      const ms = typeof publishedAt === 'number'
        ? (publishedAt < 10_000_000_000 ? publishedAt * 1000 : publishedAt)
        : Date.parse(publishedAt);
      if (ms > 0) {
        const diffH = (Date.now() - ms) / 3600000;
        if (diffH < 1) return 'Just now';
        if (diffH < 24) return `${Math.floor(diffH)}h ago`;
        if (diffH < 48) return 'Yesterday';
        return `${Math.floor(diffH / 24)}d ago`;
      }
    }
    return 'Coming Soon';
  }

  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;

  const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
  const dayNum = d.getDate().toString().padStart(2, '0');
  const month = d.toLocaleDateString('en-US', { month: 'short' });

  return `${dayName}, ${dayNum} ${month}`;
}

// Tabloid/gossip patterns that should not appear in the Release section.
// This section is for actual releases (movies, OTT, albums) — not celebrity drama.
const RELEASE_GOSSIP_PATTERNS = [
  /\bslams\b/i,
  /\btrolls\b/i,
  /\badmits\b/i,
  /\blashes out\b/i,
  /\bblasts\b/i,
  /\bcalls out\b/i,
  /\breacts to\b/i,
  /\bfeud\b/i,
  /\bbreakup\b/i,
  /\bdivorce\b/i,
  /\baffair\b/i,
  /\binfluencer\b/i,
  /\bmultiple partner/i,
  /\bopen relationship/i,
  /\bback-to-back flop/i,
  /\battempted suicide/i,
  /\bspat\b/i,
  /\bcatfight\b/i,
];

function isGossipTitle(title = '') {
  return RELEASE_GOSSIP_PATTERNS.some(pattern => pattern.test(title));
}

function buildCardArticle(item) {
  return {
    ...item,
    time: formatConciseDate(
      item?.date || item?.releaseDate,
      item?.publishedAt || item?.timestamp
    ),
    summary: item?.description || item?.summary || '',
    source: item?.source || item?.platform || item?.category || 'Up Ahead',
    imageUrl: item?.posterUrl || item?.imageUrl || null,
  };
}

function getRawData(data) {
  return data?.raw || {};
}

function getSections(data = {}, rawData = {}) {
  return data?.sections || rawData?.sections || {};
}

function getModeFromEnvelope({ envelope, data, isStaticHost }) {
  const sourceMode = data?.sourceMode || envelope?.source || 'unknown';

  if (sourceMode === 'snapshot') {
    return { sourceMode, modeStr: 'snapshot', modeLabel: 'Snapshot' };
  }

  if (sourceMode === 'cache') {
    return { sourceMode, modeStr: 'cached', modeLabel: 'Cached' };
  }

  if (sourceMode === 'seed') {
    return { sourceMode, modeStr: 'degraded', modeLabel: 'Seed' };
  }

  if (sourceMode === 'failed') {
    return { sourceMode, modeStr: 'error', modeLabel: 'Failed' };
  }

  if (isStaticHost) {
    return { sourceMode, modeStr: 'degraded', modeLabel: 'Limited' };
  }

  return { sourceMode, modeStr: 'live', modeLabel: 'Live' };
}

function deriveVisibleState(data = {}) {
  const rawData = getRawData(data);
  const sections = getSections(data, rawData);

  const weatherAlerts = Array.isArray(data.weatherAlerts)
    ? data.weatherAlerts
    : [];

  const combinedAlerts = Array.isArray(data.combinedAlerts)
    ? data.combinedAlerts
    : [
        ...weatherAlerts,
        ...(sections.alerts || []),
        ...(sections.civic || []),
      ];

  const civicAlerts = Array.isArray(data.civics)
    ? data.civics
    : (sections.civic || []);

  const offerItems = Array.isArray(data.offers)
    ? data.offers
    : [
        ...(sections.shopping || []),
        ...(sections.airlines || []),
      ];

  const eventItems = Array.isArray(data.events)
    ? data.events
    : [
        ...(sections.events || []),
        ...(sections.sports || []),
      ];

  const movieCards = (Array.isArray(data.releases) ? data.releases : (sections.movies || []))
    .filter(item => !isGossipTitle(item?.title || item?.headline || ''))
    .map(buildCardArticle);

  const festivalCards = (Array.isArray(data.festivals) ? data.festivals : (sections.festivals || []))
    .map(buildCardArticle);

  const weeklyPlan = Array.isArray(data.plan)
    ? data.plan
    : Array.isArray(rawData.weekly_plan)
      ? rawData.weekly_plan
      : [];

  const timeline = Array.isArray(data.timeline)
    ? data.timeline
    : Array.isArray(rawData.timeline)
      ? rawData.timeline
      : [];

  const highPriorityAlert = weatherAlerts[0] || combinedAlerts[0] || null;
  const alertIcon = weatherAlerts.length > 0 ? '🌪️' : '⚠️';
  const alertTitle = weatherAlerts.length > 0 ? 'Weather Warning' : 'Worth Knowing';

  return {
    rawData,
    sections,
    weeklyPlan,
    timeline,
    weatherAlerts,
    combinedAlerts,
    civicAlerts,
    offerItems,
    eventItems,
    movieCards,
    festivalCards,
    highPriorityAlert,
    alertIcon,
    alertTitle,
    evidence: data.evidence || null,
    briefing: data.briefing || null,
  };
}

function hasVisibleUpAheadProjection(visible) {
  if (!visible) return false;
  if (visible.weeklyPlan.some(day => (day?.items || []).length > 0)) return true;
  if (visible.timeline.some(day => (day?.items || []).length > 0)) return true;
  if (visible.offerItems.length > 0) return true;
  if (visible.eventItems.length > 0) return true;
  if (visible.movieCards.length > 0) return true;
  if (visible.festivalCards.length > 0) return true;
  if (visible.combinedAlerts.length > 0) return true;

  return false;
}

export function useUpAheadTabViewModel() {
  const {
    envelope,
    loading,
    error: datasetError,
    reload: reloadDataset,
  } = useDataset('upAhead');

  const settingsContext = useSettings();
  const rawSettings = settingsContext?.settings;
  const settings = useMemo(() => (
    rawSettings || {}
  ), [rawSettings]);
  const updateSettings = settingsContext?.updateSettings;

  const runtimeCapabilities = getRuntimeCapabilities();
  const envelopeData = envelope?.data;
  const data = useMemo(() => (
    envelopeData || {}
  ), [envelopeData]);

  const visible = useMemo(() => deriveVisibleState(data), [data]);

  const reload = useCallback((force = true) => {
    return reloadDataset(force);
  }, [reloadDataset]);

  const forceRefresh = useCallback(() => {
    return reloadDataset(true);
  }, [reloadDataset]);

  const addToPlan = useCallback(async (item, dateStr) => {
    try {
      const hiddenKey = item?.hiddenKey || item?.canonicalId || item?.id;
      const normalizedDate = item?.planDate || normalizePlanDate(dateStr);

      const addResult = plannerStorage.addItem(normalizedDate, {
        id: hiddenKey || item?.id,
        hiddenKey,
        title: item?.title,
        category: item?.tags?.[0] || 'event',
        type: item?.type || item?.tags?.[0] || 'event',
        link: item?.link,
        description: item?.description,
        icon: item?.icon,
        planDate: normalizedDate,
        eventDateKey: normalizedDate,
        eventDate: normalizedDate,
      });

      if (!isPlannerStorageSuccess(addResult)) {
        return {
          ok: false,
          error: getPlannerStorageError(addResult, 'Planner item was not saved'),
        };
      }

      await reloadDataset(true);

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error?.message || String(error),
      };
    }
  }, [reloadDataset]);

  const removeFromPlan = useCallback(async (item) => {
    try {
      const id = item?.hiddenKey || item?.canonicalId || item?.id;

      if (!id || !plannerStorage.addToBlacklist) {
        return {
          ok: false,
          error: 'Missing planner item id',
        };
      }

      const removeResult = plannerStorage.addToBlacklist(id);
      if (!isPlannerStorageSuccess(removeResult)) {
        return {
          ok: false,
          error: getPlannerStorageError(removeResult, 'Planner item was not removed'),
        };
      }

      await reloadDataset(true);

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error?.message || String(error),
      };
    }
  }, [reloadDataset]);

  const addLocation = useCallback((location) => {
    const loc = String(location || '').trim();

    if (!loc || typeof updateSettings !== 'function') return;

    const current = settings?.upAhead?.locations || ['Chennai', 'Muscat'];

    if (current.includes(loc)) return;

    updateSettings({
      ...settings,
      upAhead: {
        ...settings.upAhead,
        locations: [...current, loc],
      },
    });
  }, [settings, updateSettings]);

  const removeLocation = useCallback((location) => {
    if (typeof updateSettings !== 'function') return;

    const current = settings?.upAhead?.locations || ['Chennai', 'Muscat'];
    const next = current.filter(item => item !== location);

    if (next.length === 0) return;

    updateSettings({
      ...settings,
      upAhead: {
        ...settings.upAhead,
        locations: next,
      },
    });
  }, [settings, updateSettings]);

  const mode = getModeFromEnvelope({
    envelope,
    data,
    isStaticHost: runtimeCapabilities.isStaticHost,
  });

  const locationLabel = settings?.upAhead?.locations?.join(', ') || 'All Locations';
  const hasVisibleContent = hasVisibleUpAheadProjection(visible);
  const error = datasetError || envelope?.error || null;

  return {
    envelope,
    data,
    rawData: visible.rawData,
    sections: visible.sections,
    loading,
    error,
    reload,
    forceRefresh,
    addToPlan,
    removeFromPlan,
    addLocation,
    removeLocation,
    settings,
    updateSettings,
    runtimeCapabilities,
    isStaticHost: runtimeCapabilities.isStaticHost,
    sourceMode: mode.sourceMode,
    modeStr: mode.modeStr,
    modeLabel: mode.modeLabel,
    locationLabel,
    hasVisibleContent,
    weeklyPlan: visible.weeklyPlan,
    timeline: visible.timeline,
    weatherAlerts: visible.weatherAlerts,
    combinedAlerts: visible.combinedAlerts,
    civicAlerts: visible.civicAlerts,
    offerItems: visible.offerItems,
    eventItems: visible.eventItems,
    movieCards: visible.movieCards,
    festivalCards: visible.festivalCards,
    highPriorityAlert: visible.highPriorityAlert,
    alertIcon: visible.alertIcon,
    alertTitle: visible.alertTitle,
    evidence: visible.evidence,
    briefing: visible.briefing,
    warnings: [
      ...(Array.isArray(envelope?.validation?.warnings) ? envelope.validation.warnings : []),
      ...(Array.isArray(envelope?.slo?.warnings) ? envelope.slo.warnings : []),
    ],
    diagnostics: envelope?.diagnostics || [],
  };
}

export const __upAheadViewModelInternalsForTest = {
  toLocalDateKey,
  normalizePlanDate,
  formatConciseDate,
  buildCardArticle,
  getRawData,
  getSections,
  deriveVisibleState,
  hasVisibleUpAheadProjection,
  getModeFromEnvelope,
};

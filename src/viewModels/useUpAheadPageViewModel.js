import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useWatchlist } from '../hooks/useWatchlist';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import {
  fetchStaticUpAheadData,
  fetchLiveUpAheadData,
  mergeUpAheadData,
  loadFromCache,
  saveToCache,
  clearUpAheadCache,
  isActualWeatherAlertText,
  isActualOfferText,
} from '../services/upAheadService';
import plannerStorage, {
  getPlannerStorageError,
  isPlannerStorageSuccess,
} from '../utils/plannerStorage';
import { getRuntimeCapabilities } from '../runtime/runtimeCapabilities';
import { getUpAheadEvidence } from '../services/upAheadEvidence';
import { getUpAheadBriefing } from '../services/upAheadBriefing';

const DEFAULT_UPAHEAD_SETTINGS = {
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
  locations: ['Chennai', 'Muscat'],
};

const OFFER_MAX_AGE_MS         = 30 * 24 * 60 * 60 * 1000;  // 30 days (offers are awareness items; news lags)
const WEATHER_ALERT_MAX_AGE_MS = 36 * 60 * 60 * 1000;       // 36 hours
const ALERT_MAX_AGE_MS         = 48 * 60 * 60 * 1000;       // 48 hours
const CIVIC_MAX_AGE_MS         = 365 * 24 * 60 * 60 * 1000; // 1 year (drop clearly-broken dates; civic feeds are evergreen)
const CIVIC_MAX_ITEMS          = 20;                        // cap civic notices shown

function normalizePlanDate(dateStr) {
  if (!dateStr) return new Date().toISOString().slice(0, 10);

  const parsed = new Date(dateStr);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return dateStr;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asSections(data) {
  return data?.sections && typeof data.sections === 'object'
    ? data.sections
    : {};
}

function itemLocation(item) {
  return String(item?.city || item?.locationCanonical || item?.region || '').trim();
}

function matchesConfiguredLocation(item, locations) {
  const loc = itemLocation(item).toLowerCase();
  if (!loc) return false;
  return (locations || []).some(configured => {
    const c = String(configured || '').trim().toLowerCase();
    return c && (c === loc || loc.includes(c) || c.includes(loc));
  });
}

// Fallback for items (e.g. Google News shopping results) that have no explicit
// location metadata: scan title + description + source for the configured city name.
function matchesConfiguredLocationByText(item, locations) {
  const text = `${item?.title || ''} ${item?.description || ''} ${item?.source || ''}`.toLowerCase();
  return (locations || []).some(configured => {
    const c = String(configured || '').trim().toLowerCase();
    return c.length >= 4 && text.includes(c);
  });
}

function publishedMs(item) {
  return getEventDateMs(item?.publishedAt || item?.eventStartAt || item?.date || item?.timestamp);
}

function hasVisibleUpAheadContent(data) {
  if (!data) return false;
  if (Array.isArray(data.timeline) && data.timeline.some(day => (day?.items || []).length > 0)) return true;
  if (data.sections && Object.values(data.sections).some(items => Array.isArray(items) && items.length > 0)) return true;
  if (Array.isArray(data.weekly_plan) && data.weekly_plan.some(day => (day?.items || []).length > 0)) return true;
  return false;
}

function getSourceModeState({ data, runtime }) {
  const isStaticHost = Boolean(runtime?.isStaticHost);

  if (isStaticHost) {
    return {
      modeStr: data?.sourceMode === 'snapshot' ? 'snapshot' : 'degraded',
      modeLabel: data?.sourceMode === 'snapshot' ? 'Snapshot' : 'Limited',
    };
  }

  return {
    modeStr: data?.sourceMode === 'cache' ? 'cached' : 'live',
    modeLabel: data?.sourceMode === 'cache' ? 'Cached' : 'Live',
  };
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

function formatConciseDate(dateStr, publishedAt) {
  if (!dateStr) {
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

function getEventDateMs(value) {
  if (!value) return 0;

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 10_000_000_000 ? value * 1000 : value;
  }

  const numeric = Number(value);

  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

// Curated sale-campaign signatures. Online offers about the SAME campaign
// (e.g. the dozen "Amazon Prime Day 2026" write-ups from different outlets)
// are grouped into one card so the Offers tab isn't flooded with duplicates.
const OFFER_CAMPAIGNS = [
  { key: 'amazon-prime-day', re: /\bprime day\b/i },
  { key: 'flipkart-big-billion-days', re: /\bbig billion days\b/i },
  { key: 'amazon-great-indian', re: /\bgreat indian (festival|sale)\b/i },
  { key: 'myntra-eoss', re: /\b(end of season sale|eoss)\b/i },
  { key: 'target-circle-week', re: /\bcircle (week|deal days)\b/i },
  { key: 'black-friday', re: /\bblack friday\b/i },
  { key: 'cyber-monday', re: /\bcyber monday\b/i },
  { key: 'festive-sale', re: /\b(diwali|festive) sale\b/i },
  { key: 'independence-day-sale', re: /\bindependence day sale\b/i },
  { key: 'republic-day-sale', re: /\brepublic day sale\b/i },
];

function offerCampaignKey(item) {
  const text = `${item?.title || ''} ${item?.description || ''}`;
  for (const campaign of OFFER_CAMPAIGNS) {
    if (campaign.re.test(text)) return campaign.key;
  }
  return null;
}

// Group online offers by sale campaign. Offers that don't match a known
// campaign are kept as-is. Each group keeps the newest item as the
// representative and exposes sourceCount + grouped members for the UI.
function groupOnlineOffers(offers = []) {
  const groups = new Map();
  const singles = [];

  for (const offer of offers) {
    const key = offerCampaignKey(offer);
    if (!key) {
      singles.push(offer);
      continue;
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(offer);
  }

  const grouped = [];
  for (const members of groups.values()) {
    if (members.length === 1) {
      grouped.push(members[0]);
      continue;
    }
    const sorted = [...members].sort((a, b) => publishedMs(b) - publishedMs(a));
    const representative = sorted[0];
    const sources = [...new Set(members.map(m => m.source).filter(Boolean))];
    grouped.push({
      ...representative,
      sourceCount: Math.max(Number(representative.sourceCount || 1), sources.length || members.length),
      sources,
      groupedOffers: sorted,
      groupedCount: members.length,
    });
  }

  return [...grouped, ...singles];
}

// Sort key for the Suggested feed: prefer a real upcoming event/release date,
// otherwise fall back to publish recency.
function getSuggestedSortMs(item) {
  const eventMs = getEventDateMs(item?.date || item?.releaseDate || item?.eventStartAt);
  if (eventMs > 0) return eventMs;
  return publishedMs(item);
}

// The "Suggested" tab is the automatic, cross-category feed (the planner is
// manual-only). Combine the auto-derived categories — releases, events,
// festivals, offers, civic — rank them (soonest upcoming first, then most
// recent), dedupe, and cap.
function buildSuggestedItems({ movieCards, festivalCards, eventItems, onlineOffers, offlineOffers, civicAlerts } = {}) {
  const tagged = [
    ...asArray(movieCards).map(item => ({ ...item, _suggestKind: 'release' })),
    ...asArray(festivalCards).map(item => ({ ...item, _suggestKind: 'festival' })),
    ...asArray(eventItems).map(item => ({ ...item, _suggestKind: 'event' })),
    ...asArray(onlineOffers).map(item => ({ ...item, _suggestKind: 'offer', isOffer: true })),
    ...asArray(offlineOffers).map(item => ({ ...item, _suggestKind: 'offer', isOffer: true })),
    ...asArray(civicAlerts).map(item => ({ ...item, _suggestKind: 'civic' })),
  ];

  const seen = new Set();
  const deduped = [];
  for (const item of tagged) {
    const key = String(item?.id || item?.link || item?.url || item?.title || '').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  const now = Date.now();
  return deduped
    .sort((a, b) => {
      const aMs = getSuggestedSortMs(a);
      const bMs = getSuggestedSortMs(b);
      const aUpcoming = aMs >= now;
      const bUpcoming = bMs >= now;
      if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1; // upcoming before past
      if (aUpcoming) return aMs - bMs;                        // soonest upcoming first
      return bMs - aMs;                                       // most recent first
    })
    .slice(0, 24);
}

function getVisibleUpAheadProjection({ data, settings }) {
  const sections = asSections(data);
  const upAheadSettings = settings?.upAhead || DEFAULT_UPAHEAD_SETTINGS;

  const weatherAlerts = asArray(sections.weather_alerts).filter(item => {
    if (!isActualWeatherAlertText(`${item?.title || ''} ${item?.description || ''}`, upAheadSettings)) return false;
    const age = getEventDateMs(item?.publishedAt || item?.eventStartAt || item?.date || item?.timestamp);
    if (age > 0 && (Date.now() - age) > WEATHER_ALERT_MAX_AGE_MS) return false;
    return true;
  });
  const generalAlerts = asArray(sections.alerts).filter(item => {
    const age = getEventDateMs(item?.publishedAt || item?.eventStartAt || item?.date || item?.timestamp);
    return age === 0 || (Date.now() - age) <= ALERT_MAX_AGE_MS;
  });

  const locations = upAheadSettings.locations || DEFAULT_UPAHEAD_SETTINGS.locations;

  // Civic notices are dateless "current awareness" items: filter to the user's
  // configured locations (explicit + configurable), drop clearly-broken dates with
  // a generous 1-year window, sort newest-first, and cap. This is the single source
  // for both the Civics tab and the civic portion of the Alerts badge.
  const civicItems = asArray(sections.civic)
    .filter(item => matchesConfiguredLocation(item, locations))
    .filter(item => {
      const age = publishedMs(item);
      return age === 0 || (Date.now() - age) <= CIVIC_MAX_AGE_MS;
    })
    .sort((a, b) => publishedMs(b) - publishedMs(a))
    .slice(0, CIVIC_MAX_ITEMS);
  const civicAlerts = civicItems;
  const combinedAlerts = [...weatherAlerts, ...generalAlerts, ...civicItems];

  // Offers, quality-gated by offer keywords, newest-first.
  // Online = city-agnostic e-commerce + airlines. These are time-sensitive (Prime
  // Day, flash/fare sales) so use the tight 30-day window.
  const onlineOfferCandidates = [
    ...asArray(sections.shopping),
    ...asArray(sections.airlines),
  ].filter(item => {
    if (itemLocation(item)) return false; // city-agnostic only
    if (!isActualOfferText(`${item?.title || ''} ${item?.description || ''}`, upAheadSettings)) return false;
    const publishedAt = publishedMs(item);
    if (publishedAt && (Date.now() - publishedAt) > OFFER_MAX_AGE_MS) return false;
    return true;
  });

  // Group near-duplicate online offers (e.g. the many "Amazon Prime Day 2026"
  // write-ups from different outlets) into a single representative carrying a
  // sourceCount, so the Offers tab shows one card per deal instead of a dozen.
  const onlineOffers = groupOnlineOffers(onlineOfferCandidates)
    .sort((a, b) => publishedMs(b) - publishedMs(a));

  // Offline = location-matched local shopping. These feeds are already offer-
  // intentioned (e.g. "Chennai sale … OR offer") but sparse & evergreen, so we skip
  // the strict keyword gate and instead location-match with the same generous window
  // + cap as civic, recency-sorted.
  // Google News RSS items carry no explicit location metadata, so fall back to
  // text scanning when city/locationCanonical/region fields are all absent.
  const offlineOffers = asArray(sections.shopping)
    .filter(item =>
      itemLocation(item)
        ? matchesConfiguredLocation(item, locations)
        : matchesConfiguredLocationByText(item, locations)
    )
    .filter(item => {
      const publishedAt = publishedMs(item);
      return publishedAt === 0 || (Date.now() - publishedAt) <= CIVIC_MAX_AGE_MS;
    })
    .sort((a, b) => publishedMs(b) - publishedMs(a))
    .slice(0, CIVIC_MAX_ITEMS);

  const offerItems = [...onlineOffers, ...offlineOffers]; // combined, for backward-compat

  const movieCards = asArray(sections.movies).map(buildCardArticle);
  const festivalCards = asArray(sections.festivals).map(buildCardArticle);
  const eventItems = [
    ...asArray(sections.events),
    ...asArray(sections.sports),
  ];

  const suggestedItems = buildSuggestedItems({
    movieCards,
    festivalCards,
    eventItems,
    onlineOffers,
    offlineOffers,
    civicAlerts,
  });

  const visible = {
    weatherAlerts,
    generalAlerts,
    civicAlerts,
    civicItems,
    combinedAlerts,
    offerItems,
    onlineOffers,
    offlineOffers,
    movieCards,
    festivalCards,
    eventItems,
    suggestedItems,
  };

  return {
    ...visible,
    upAheadEvidence: getUpAheadEvidence({
      data,
      settings,
      visible,
    }),
    upAheadBriefing: getUpAheadBriefing({
      data,
      settings,
      visible,
    }),
  };
}

export function useUpAheadPageViewModel() {
  const { settings, updateSettings } = useSettings();
  const { toggleWatchlist, isWatched, watchlistError } = useWatchlist();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const [view, setView] = useState('plan');
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [, setBlacklist] = useState(plannerStorage.getBlacklist ? plannerStorage.getBlacklist() : new Set());

  const runtime = useMemo(() => (
    getRuntimeCapabilities()
  ), []);

  const upAheadSettings = settings?.upAhead || DEFAULT_UPAHEAD_SETTINGS;

  const loadData = useCallback(async ({ forceRefresh = false, liveOnly = false } = {}) => {
    if (!runtime.isStaticHost) {
      await plannerStorage.loadBlacklistFromApi?.();
      await plannerStorage.loadPlanFromApi?.();
    }

    if (forceRefresh) {
      clearUpAheadCache();
      if (liveOnly) {
        setLoading(true);
        setLoadingPhase(0);
      }

      setIsRefreshing(true);
      setLoadingPhase(1);
    } else {
      setLoading(true);
      setLoadingPhase(0);
    }

    if (!forceRefresh && !liveOnly) {
      const cached = loadFromCache(upAheadSettings);

      if (cached) {
        setData(cached);
        setLoading(false);
        setLoadingPhase(1);
      }
    }

    if (!liveOnly) {
      try {
        const staticData = await fetchStaticUpAheadData(upAheadSettings);

        if (staticData) {
          setData(prev => {
            const merged = mergeUpAheadData(prev, staticData, upAheadSettings);
            saveToCache(merged, upAheadSettings);
            return merged;
          });

          if (!forceRefresh) setLoadingPhase(2);
          setLoading(false);
        }
      } catch (error) {
        console.warn('Static Up Ahead fetch failed', error);
      }
    }

    setIsRefreshing(true);

    try {
      const liveData = await fetchLiveUpAheadData(upAheadSettings);

      setData(prev => {
        const merged = mergeUpAheadData(prev, liveData, upAheadSettings);
        saveToCache(merged, upAheadSettings);
        return merged;
      });

      setLoadingPhase(3);
    } catch (error) {
      console.error('Failed to load Live Up Ahead data', error);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  }, [runtime.isStaticHost, upAheadSettings]);

  const { pullDistance } = usePullToRefresh(() => (
    loadData({ forceRefresh: true, liveOnly: true })
  ));

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRemoveFromPlan = useCallback((item) => {
    const id = item?.hiddenKey || item?.canonicalId || item?.id;

    if (!id) return;

    if (plannerStorage.addToBlacklist) {
      const result = plannerStorage.addToBlacklist(id);
      if (!isPlannerStorageSuccess(result)) {
        if (typeof window !== 'undefined' && typeof window.alert === 'function') {
          window.alert(getPlannerStorageError(result, 'Planner item was not removed'));
        }
        return result;
      }

      setBlacklist(plannerStorage.getBlacklist());
      loadData();
    }
  }, [loadData]);

  const handleAddToPlan = useCallback((item, dateStr) => {
    const hiddenKey = item?.hiddenKey || item?.canonicalId || item?.id;
    const normalizedDate = item?.planDate || normalizePlanDate(dateStr);

    const result = plannerStorage.addItem(normalizedDate, {
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

    if (!isPlannerStorageSuccess(result)) {
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(getPlannerStorageError(result, 'Planner item was not saved'));
      }
      return result;
    }

    loadData();

    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert('Added to Plan!');
    }

    return { ok: true };
  }, [loadData]);

  const removeUpAheadLocation = useCallback((location) => {
    const current = upAheadSettings.locations || ['Chennai', 'Muscat'];
    const next = current.filter(item => item !== location);

    if (next.length > 0 && typeof updateSettings === 'function') {
      updateSettings({
        ...settings,
        upAhead: {
          ...settings.upAhead,
          locations: next,
        },
      });
    }
  }, [settings, upAheadSettings.locations, updateSettings]);

  const addUpAheadLocation = useCallback((location) => {
    const cleanLocation = String(location || '').trim();

    if (!cleanLocation) return;

    const current = upAheadSettings.locations || ['Chennai', 'Muscat'];

    if (!current.includes(cleanLocation) && typeof updateSettings === 'function') {
      updateSettings({
        ...settings,
        upAhead: {
          ...settings.upAhead,
          locations: [...current, cleanLocation],
        },
      });
    }
  }, [settings, upAheadSettings.locations, updateSettings]);

  const promptAddUpAheadLocation = useCallback(() => {
    if (typeof window === 'undefined' || typeof window.prompt !== 'function') return;

    const location = window.prompt('Add location (e.g. Trichy, Dubai):');
    addUpAheadLocation(location);
  }, [addUpAheadLocation]);

  const visibleProjection = useMemo(() => (
    getVisibleUpAheadProjection({
      data,
      settings,
    })
  ), [data, settings]);

  const sourceModeState = useMemo(() => (
    getSourceModeState({
      data,
      runtime,
    })
  ), [data, runtime]);

  const locationLabel = useMemo(() => (
    upAheadSettings.locations?.join(', ') || 'All Locations'
  ), [upAheadSettings.locations]);

  return {
    data,
    loading,
    isRefreshing,
    loadingPhase,
    view,
    showDiagnostics,
    pullDistance,

    runtime,
    isStaticHost: runtime.isStaticHost,
    upAheadSettings,
    locationLabel,

    hasVisibleContent: hasVisibleUpAheadContent(data),
    modeStr: sourceModeState.modeStr,
    modeLabel: sourceModeState.modeLabel,

    ...visibleProjection,

    setView,
    setShowDiagnostics,
    loadData,
    handleAddToPlan,
    handleRemoveFromPlan,
    removeUpAheadLocation,
    addUpAheadLocation,
    promptAddUpAheadLocation,
    toggleWatchlist,
    watchlistError,
    isWatched,
  };
}

export const __upAheadPageViewModelInternalsForTest = {
  DEFAULT_UPAHEAD_SETTINGS,
  OFFER_MAX_AGE_MS,
  normalizePlanDate,
  asArray,
  asSections,
  hasVisibleUpAheadContent,
  getSourceModeState,
  buildCardArticle,
  formatConciseDate,
  getEventDateMs,
  getVisibleUpAheadProjection,
  buildSuggestedItems,
};

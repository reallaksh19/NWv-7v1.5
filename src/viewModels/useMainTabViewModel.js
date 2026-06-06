import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDataset } from '../data/orchestrator/useDataset.js';
import { useWeather } from '../context/WeatherContext';
import { useNews } from '../context/NewsContext';
import { useSettings } from '../context/SettingsContext';
import { useSegment } from '../context/SegmentContext';
import { getRuntimeCapabilities } from '../runtime/runtimeCapabilities.js';
import { getTopline } from '../utils/timeSegment';
import { generateTopline, fetchOnThisDay } from '../utils/toplineGenerator';
import { shouldShowOnThisDay } from '../services/onThisDayPolicy.js';
import { getViewCount, isArticleRead } from '../utils/storage';
import { requestNotificationPermission } from '../utils/notifications';
import { getTravelLocationProfile } from '../services/travelLocationProfile.js';
import { applyTravelLocationPriority } from '../services/storyLocationPriority.js';
import {
  fetchTravelNewsPayload,
  mergeTravelNewsIntoNewsData,
} from '../services/travelNewsIngestion.js';
import { auditMainTabQuality } from '../services/pageAuditGrading.js';
import { isBreakingStory } from '../services/breakingNewsService.js';
import { temporalScore } from '../services/temporalScorer.js';

const MIN_CUSTOM_TOP_STORIES = 10;
const MAX_VIEW_COUNT_FOR_CUSTOM_TOP_STORIES = 3;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function getBrowserNotificationPermission() {
  if (typeof Notification === 'undefined') return 'default';
  return Notification.permission;
}

function filterLatestStories(frontPage = [], customSortTopStories = false) {
  const stories = asArray(frontPage);

  if (!customSortTopStories) return stories;

  // Sort by temporal-decayed score (freshness + impact), not raw impact score (RC-2 fix)
  const now = Date.now();
  const decayed = (a) => temporalScore(a.impactScore || 0, a.publishedAt, now);
  const sorted = [...stories].sort((a, b) => decayed(b) - decayed(a));

  const breaking = [];
  const fresh = [];
  const rest = [];

  for (const item of sorted) {
    // L3 — breaking news is always pinned to the top and is exempt from the
    // "seen / over-viewed" demotion, so a major story can't be pushed down just
    // because the user already glanced at it.
    if (isBreakingStory(item)) {
      breaking.push(item);
    } else if (item?.id && (isArticleRead(item.id) || getViewCount(item.id) > MAX_VIEW_COUNT_FOR_CUSTOM_TOP_STORIES)) {
      rest.push(item);
    } else {
      fresh.push(item);
    }
  }

  // Keep breaking pinned at the top, ranked by breaking score.
  breaking.sort((a, b) =>
    (Number(b.breakingScore || 0) - Number(a.breakingScore || 0)) ||
    (Number(b.publishedAt || 0) - Number(a.publishedAt || 0)));

  if (breaking.length + fresh.length >= MIN_CUSTOM_TOP_STORIES) {
    return [...breaking, ...fresh];
  }

  return [
    ...breaking,
    ...fresh,
    ...rest.slice(0, Math.max(0, MIN_CUSTOM_TOP_STORIES - breaking.length - fresh.length)),
  ];
}


function getNavSections(sections = {}) {
  return [
    { id: 'top-stories', icon: '⭐', label: 'Top' },
    sections.india?.enabled && { id: 'india-news', icon: '🇮🇳', label: 'India' },
    sections.chennai?.enabled && { id: 'chennai-news', icon: '🏛️', label: 'Tamil Nadu' },
    sections.local?.enabled && { id: 'local-news', icon: '📍', label: 'Muscat' },
    { id: 'world-news', icon: '🌍', label: 'World' },
  ].filter(Boolean);
}


function getProjectedMainData({ envelope, newsData, weatherData, breakingNews }) {
  const data = asRecord(envelope?.data);

  const datasetNewsData = asRecord(data.newsData);
  const datasetFrontPage = asArray(data.frontPage);
  const datasetSections = asRecord(data.sections);
  const rawNewsData = asRecord(data.raw?.newsData);

  const projectedNewsData = Object.keys(datasetNewsData).length > 0
    ? datasetNewsData
    : datasetFrontPage.length > 0
      ? {
          ...asRecord(newsData),
          frontPage: datasetFrontPage,
          world: asArray(datasetSections.world || newsData?.world),
          india: asArray(datasetSections.india || newsData?.india),
          chennai: asArray(datasetSections.chennai || newsData?.chennai),
          local: asArray(datasetSections.local || newsData?.local),
        }
      : Object.keys(rawNewsData).length > 0
        ? rawNewsData
        : asRecord(newsData);

  return {
    newsData: projectedNewsData,

    weatherData: Object.keys(asRecord(data.weatherData)).length > 0
      ? asRecord(data.weatherData)
      : Object.keys(asRecord(data.quickWeather)).length > 0
        ? asRecord(data.quickWeather)
        : weatherData,

    breakingNews: asArray(data.breakingNews).length > 0
      ? asArray(data.breakingNews)
      : asArray(data.topline?.breakingNews).length > 0
        ? asArray(data.topline.breakingNews)
        : asArray(breakingNews),
  };
}

function makeMainBoundaryEnvelope({
  envelope,
  newsData,
  weatherData,
  breakingNews,
  isLoading,
  error,
}) {
  const hasNews = Object.keys(asRecord(newsData)).length > 0;
  const hasWeather = Boolean(weatherData && Object.keys(asRecord(weatherData)).length > 0);
  const hasBreaking = asArray(breakingNews).length > 0;
  const hasRenderableMain = hasNews || hasWeather || hasBreaking;

  if (envelope) {
    const existingValidation = envelope.validation || {};

    return {
      ...envelope,
      ok: Boolean(envelope.ok !== false && hasRenderableMain),
      freshness: hasRenderableMain ? (envelope.freshness || 'fresh') : 'empty',
      error: hasRenderableMain ? (envelope.error || null) : (envelope.error || error || null),
      data: {
        ...(envelope.data || {}),
        newsData,
        weatherData,
        breakingNews,
        projectedHasRenderableMain: hasRenderableMain,
      },
      validation: {
        ...existingValidation,
        passed: Boolean(existingValidation.passed !== false && hasRenderableMain),
        errors: hasRenderableMain
          ? (Array.isArray(existingValidation.errors) ? existingValidation.errors : [])
          : [
              ...(Array.isArray(existingValidation.errors) ? existingValidation.errors : []),
              ...(error ? ['main_projection_error'] : []),
            ],
        warnings: [
          ...(Array.isArray(existingValidation.warnings) ? existingValidation.warnings : []),
          ...(!hasRenderableMain && isLoading ? ['main_loading_without_renderable_projection'] : []),
          ...(!hasRenderableMain && !isLoading ? ['main_no_renderable_data'] : []),
        ],
      },
      diagnostics: [
        ...(Array.isArray(envelope.diagnostics) ? envelope.diagnostics : []),
        {
          event: 'main.view_model.projected_data',
          severity: hasRenderableMain ? 'info' : 'warn',
          message: hasRenderableMain
            ? 'Main ViewModel projected render-ready home data.'
            : 'Main ViewModel has no renderable home data yet.',
        },
      ],
    };
  }

  return {
    ok: hasRenderableMain,
    datasetId: 'main',
    data: {
      newsData,
      weatherData,
      breakingNews,
      projectedHasRenderableMain: hasRenderableMain,
    },
    source: 'context',
    freshness: hasRenderableMain ? 'fresh' : 'empty',
    validation: {
      passed: hasRenderableMain,
      errors: hasRenderableMain ? [] : (error ? [error] : []),
      warnings: [
        ...(isLoading ? ['main_loading_without_renderable_projection'] : []),
        ...(!hasRenderableMain && !isLoading ? ['main_no_renderable_data'] : []),
      ],
    },
    diagnostics: [
      {
        event: 'main.view_model.context_projection',
        severity: hasRenderableMain ? 'info' : 'warn',
        message: hasRenderableMain
          ? 'Main ViewModel used context projection while dataset envelope was unavailable.'
          : 'Main ViewModel is waiting for context data.',
      },
    ],
  };
}

function getRefreshOutcome(results) {
  const rejected = results.find(result => result.status === 'rejected');

  const fulfilledValues = results
    .filter(result => result.status === 'fulfilled')
    .map(result => result.value);

  const failedEnvelope = fulfilledValues.find(value => (
    value && typeof value === 'object' && value.ok === false
  ));

  const hasAnySuccess = fulfilledValues.some(value => (
    value === undefined ||
    value === true ||
    value?.ok === true
  ));

  if (rejected && !hasAnySuccess) {
    return {
      ok: false,
      error: rejected.reason?.message || String(rejected.reason),
      results,
    };
  }

  if (failedEnvelope && hasAnySuccess) {
    return {
      ok: true,
      degraded: true,
      error: failedEnvelope.error || 'Main refresh partially degraded',
      results,
    };
  }

  if (failedEnvelope) {
    return {
      ok: false,
      error: failedEnvelope.error || 'Main refresh returned degraded data',
      results,
    };
  }

  if (rejected) {
    return {
      ok: true,
      degraded: true,
      error: rejected.reason?.message || String(rejected.reason),
      results,
    };
  }

  return {
    ok: true,
    results,
  };
}

function getFirstNewsError(newsErrors) {
  if (Array.isArray(newsErrors)) return newsErrors[0] || null;
  if (typeof newsErrors === 'string') return newsErrors;
  if (newsErrors && typeof newsErrors === 'object') {
    return newsErrors.message || Object.values(newsErrors).find(Boolean) || null;
  }
  return null;
}

export function useMainTabViewModel() {
  const {
    envelope: datasetEnvelope,
    loading: datasetLoading,
    error: datasetError,
    reload: reloadDataset,
  } = useDataset('main');

  const { settings, updateSettings } = useSettings();
  const { currentSegment } = useSegment();

  const {
    weatherData,
    loading: weatherLoading,
    refreshWeather,
    ensureBoot: ensureWeatherBoot,
  } = useWeather();

  const {
    newsData,
    loading: newsLoading,
    errors: newsErrors,
    breakingNews,
    refreshNews,
  } = useNews();

  const isInitialSegmentRefreshDone = useRef(false);
  const [notifPermission, setNotifPermission] = useState(getBrowserNotificationPermission);
  const [travelNewsPayload, setTravelNewsPayload] = useState(null);
  const [onThisDay, setOnThisDay] = useState(null);
  // Persists last non-null topline so it survives data refreshes
  const [toplineContent, setToplineContent] = useState(null);

  const safeSettings = useMemo(() => (
    settings || {}
  ), [settings]);
  const rawSections = safeSettings.sections;
  const sections = useMemo(() => (
    rawSections || {}
  ), [rawSections]);
  const uiMode = safeSettings.uiMode || 'timeline';

  const projected = useMemo(() => getProjectedMainData({
    envelope: datasetEnvelope,
    newsData,
    weatherData,
    breakingNews,
  }), [datasetEnvelope, newsData, weatherData, breakingNews]);

  const projectedNewsData = projected.newsData;
  const projectedWeatherData = projected.weatherData;
  const projectedBreakingNews = projected.breakingNews;

  const travelLocationProfile = useMemo(
    () => getTravelLocationProfile(safeSettings),
    [safeSettings]
  );

  useEffect(() => {
    if (!travelLocationProfile?.prioritizeStories) {
      // When priority is disabled, the travelMergedNewsData memo already
      // falls back to projectedNewsData — no synchronous setState needed here
      return undefined;
    }

    let cancelled = false;

    fetchTravelNewsPayload({ profile: travelLocationProfile })
      .then(payload => {
        if (!cancelled) setTravelNewsPayload(payload);
      })
      .catch(error => {
        console.warn('[useMainTabViewModel] travel news fetch failed', {
          message: error?.message || String(error),
        });

        if (!cancelled) setTravelNewsPayload(null);
      });

    return () => {
      cancelled = true;
    };
  }, [travelLocationProfile]);

  const travelMergedNewsData = useMemo(() => (
    travelNewsPayload && travelLocationProfile?.prioritizeStories
      ? mergeTravelNewsIntoNewsData(projectedNewsData, travelNewsPayload, travelLocationProfile)
      : projectedNewsData
  ), [projectedNewsData, travelNewsPayload, travelLocationProfile]);

  const prioritizedNewsData = useMemo(() => (
    applyTravelLocationPriority(travelMergedNewsData, travelLocationProfile)
  ), [travelMergedNewsData, travelLocationProfile]);

  const latestStories = useMemo(() => {
    const sourceFrontPage = travelLocationProfile?.prioritizeStories
      ? prioritizedNewsData.frontPage
      : projectedNewsData.frontPage;

    return filterLatestStories(sourceFrontPage, safeSettings.customSortTopStories);
  }, [
    prioritizedNewsData.frontPage,
    projectedNewsData.frontPage,
    safeSettings.customSortTopStories,
    travelLocationProfile?.prioritizeStories,
  ]);

  const navSections = useMemo(() => (
    getNavSections(sections)
  ), [sections]);

  const isTimelineMode = uiMode === 'timeline';
  const isUrgentMode = currentSegment?.id === 'urgent_only';

  const isLoading = Boolean(
    (weatherLoading && !projectedWeatherData) ||
    (newsLoading && Object.keys(projectedNewsData).length === 0) ||
    (datasetLoading && Object.keys(projectedNewsData).length === 0 && !projectedWeatherData)
  );

  const loadingPhase = isLoading ? 1 : 3;

  const refreshAll = useCallback(async () => {
    const results = await Promise.allSettled([
      reloadDataset(true),
      refreshWeather(true),
      refreshNews(),
    ]);

    return getRefreshOutcome(results);
  }, [refreshNews, refreshWeather, reloadDataset]);

  const refreshForSegment = useCallback(async () => {
    const results = await Promise.allSettled([
      reloadDataset(true),
      refreshWeather(),
      refreshNews(),
    ]);

    return getRefreshOutcome(results);
  }, [refreshNews, refreshWeather, reloadDataset]);

  useEffect(() => {
    if (typeof ensureWeatherBoot === 'function') {
      ensureWeatherBoot();
    }
  }, [ensureWeatherBoot]);

  useEffect(() => {
    if (!isInitialSegmentRefreshDone.current) {
      isInitialSegmentRefreshDone.current = true;
      return;
    }

    refreshForSegment();
  }, [currentSegment?.id, refreshForSegment]);

  useEffect(() => {
    let cancelled = false;

    fetchOnThisDay()
      .then(event => {
        if (!cancelled && event) setOnThisDay(event);
      })
      .catch(error => {
        console.warn('[useMainTabViewModel] On This Day fetch failed', {
          message: error?.message || String(error),
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const generatedTopline = useMemo(() => {
    const hasNews = projectedNewsData && Object.keys(projectedNewsData).length > 0;
    const hasWeather = projectedWeatherData && Object.keys(asRecord(projectedWeatherData)).length > 0;

    if (hasNews || hasWeather || onThisDay) {
      const isOnThisDayEnabled = shouldShowOnThisDay(safeSettings);

      return generateTopline(
        prioritizedNewsData,
        projectedWeatherData,
        onThisDay,
        { includeOnThisDay: isOnThisDayEnabled }
      );
    }

    return null;
  }, [projectedNewsData, projectedWeatherData, onThisDay, prioritizedNewsData, safeSettings]);

  useEffect(() => {
    if (generatedTopline) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToplineContent(generatedTopline);
    }
  }, [generatedTopline]);

  const fallbackTopline = useMemo(() => (
    getTopline(currentSegment)
  ), [currentSegment]);

  const requestPermission = useCallback(async () => {
    const granted = await requestNotificationPermission();
    const nextPermission = granted ? 'granted' : 'denied';

    setNotifPermission(nextPermission);

    return nextPermission;
  }, []);

  const mainTabAudit = useMemo(() => auditMainTabQuality({
    newsData: projectedNewsData,
    weatherData: projectedWeatherData,
    breakingNews: projectedBreakingNews,
    settings: safeSettings,
    loading: newsLoading,
    errors: newsErrors,
  }), [
    projectedNewsData,
    projectedWeatherData,
    projectedBreakingNews,
    safeSettings,
    newsLoading,
    newsErrors,
  ]);

  // --- Runtime capabilities (6H: shell runtime badge; computed once) ---
  const runtime = useMemo(() => getRuntimeCapabilities(), []);

  // --- Shell binding props (6G–6H) ---
  const toggleTheme = useCallback((nextTheme) => {
    const normalizedTheme = nextTheme === 'light' ? 'light' : 'dark';

    try {
      if (typeof updateSettings === 'function') {
        return updateSettings({
          ...safeSettings,
          theme: normalizedTheme,
        });
      }

      return null;
    } catch (error) {
      console.warn('[useMainTabViewModel] theme toggle failed', {
        message: error?.message || String(error),
      });

      return {
        ok: false,
        error: error?.message || String(error),
      };
    }
  }, [safeSettings, updateSettings]);

  const themeToggleProps = useMemo(() => ({
    theme: safeSettings.theme || 'dark',
    onToggleTheme: toggleTheme,
  }), [safeSettings.theme, toggleTheme]);

  const shellRuntimeProps = useMemo(() => ({
    showStaticHostBadge: Boolean(runtime?.isStaticHost),
    staticHostBadgeTitle: 'Static-host mode: snapshot/cache-first behavior is active.',
    staticHostBadgeLabel: 'Static-host mode',
    staticHostBadgeIcon: '📦',
  }), [runtime?.isStaticHost]);

  // --- Binding marker stubs (6B–6F markers preserved for downstream gate checks) ---
  // quickWeatherProps, newsSectionProps, travelLocalStoriesProps: populated in 6K
  // marketTickerProps, ensureMarketBoot, getMarketTickerDataState: populated in 6J
  const quickWeatherProps = null;
  const newsSectionProps = null;
  const travelLocalStoriesProps = null;
  const marketTickerProps = null;
  const ensureMarketBoot = null;
  const getMarketTickerDataState = null;

  const newsError = getFirstNewsError(newsErrors);
  const error = datasetError || newsError || null;

  const boundaryEnvelope = useMemo(() => makeMainBoundaryEnvelope({
    envelope: datasetEnvelope,
    newsData: projectedNewsData,
    weatherData: projectedWeatherData,
    breakingNews: projectedBreakingNews,
    isLoading,
    error,
  }), [
    datasetEnvelope,
    projectedNewsData,
    projectedWeatherData,
    projectedBreakingNews,
    isLoading,
    error,
  ]);

  return {
    envelope: boundaryEnvelope,
    datasetEnvelope,
    settings: safeSettings,
    sections,
    uiMode,
    currentSegment,
    notifPermission,
    requestPermission,
    weatherData: projectedWeatherData,
    weatherLoading,
    newsData: projectedNewsData,
    loading: newsLoading,
    errors: newsErrors,
    breakingNews: projectedBreakingNews,
    travelLocationProfile,
    travelNewsPayload,
    travelMergedNewsData,
    prioritizedNewsData,
    latestStories,
    toplineContent,
    fallbackTopline,
    onThisDay,
    mainTabAudit,
    navSections,
    refreshAll,
    isLoading,
    loadingPhase,
    isTimelineMode,
    isUrgentMode,
    error,
    source: boundaryEnvelope?.source || null,
    freshness: boundaryEnvelope?.freshness || null,
    slo: boundaryEnvelope?.slo || null,
    warnings: [
      ...(Array.isArray(boundaryEnvelope?.validation?.warnings) ? boundaryEnvelope.validation.warnings : []),
      ...(Array.isArray(boundaryEnvelope?.slo?.warnings) ? boundaryEnvelope.slo.warnings : []),
    ],
    diagnostics: boundaryEnvelope?.diagnostics || [],
    // Shell binding props (6G–6H)
    themeToggleProps,
    shellRuntimeProps,
    // Binding marker stubs (6B–6F compatibility; populated in 6J–6K)
    quickWeatherProps,
    newsSectionProps,
    travelLocalStoriesProps,
    marketTickerProps,
    ensureMarketBoot,
    getMarketTickerDataState,
  };
}

export const __mainViewModelInternalsForTest = {
  MIN_CUSTOM_TOP_STORIES,
  MAX_VIEW_COUNT_FOR_CUSTOM_TOP_STORIES,
  asArray,
  asRecord,
  getBrowserNotificationPermission,
  filterLatestStories,
  getNavSections,
  getProjectedMainData,
  makeMainBoundaryEnvelope,
  getRefreshOutcome,
  getFirstNewsError,
};

import { useCallback, useMemo } from 'react';
import { useDataset } from '../data/orchestrator/useDataset.js';
import { useSettings } from '../context/SettingsContext';

const ENTERTAINMENT_TABS = Object.freeze([
  { id: 'tamil', icon: '🎭', label: 'Tamil' },
  { id: 'hindi', icon: '🎪', label: 'Hindi' },
  { id: 'hollywood', icon: '🎬', label: "H'wood" },
  { id: 'ott', icon: '📺', label: 'OTT' },
]);

const SOCIAL_REGION_LABELS = Object.freeze({
  world: '🌍 World',
  india: '🇮🇳 India',
  tamilnadu: '🏛️ Tamil Nadu',
  muscat: '🏝️ Muscat',
});

const DEFAULT_SOCIAL_COUNTS = Object.freeze({
  world: 8,
  india: 8,
  tamilnadu: 5,
  muscat: 4,
});

const EMPTY_SETTINGS = Object.freeze({});
const EMPTY_BUZZ_DATA = Object.freeze({});

function getTimestamp(item) {
  const candidates = [
    item?.publishedAt,
    item?.timestamp,
    item?.date,
    item?.pubDate,
    item?.extractedDate,
  ];

  for (const value of candidates) {
    if (value == null) continue;

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value < 10_000_000_000 ? value * 1000 : value;
    }

    const numeric = Number(value);

    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
    }

    const parsed = Date.parse(value);

    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return 0;
}

function filterOldNews(newsArray, freshnessLimitHours = 72, now = Date.now()) {
  if (!Array.isArray(newsArray)) return [];

  const limitMs = Number(freshnessLimitHours || 72) * 60 * 60 * 1000;

  return newsArray.filter(item => {
    const publishedAt = getTimestamp(item);

    if (!publishedAt) return true;

    return now - publishedAt < limitMs;
  });
}

function normalizeEntertainment(entertainment = {}, freshnessLimitHours, now = Date.now()) {
  return ENTERTAINMENT_TABS.reduce((acc, tab) => {
    acc[tab.id] = filterOldNews(entertainment?.[tab.id] || [], freshnessLimitHours, now)
      .map(item => ({
        ...item,
        region: item.region || tab.id,
      }));

    return acc;
  }, {});
}

function getSocialDistribution(settings = {}) {
  return {
    world: settings.socialTrends?.worldCount ?? DEFAULT_SOCIAL_COUNTS.world,
    india: settings.socialTrends?.indiaCount ?? DEFAULT_SOCIAL_COUNTS.india,
    tamilnadu: settings.socialTrends?.tamilnaduCount ?? DEFAULT_SOCIAL_COUNTS.tamilnadu,
    muscat: settings.socialTrends?.muscatCount ?? DEFAULT_SOCIAL_COUNTS.muscat,
  };
}

function flattenSocialTrends(socialTrends = {}, settings = {}, freshnessLimitHours, now = Date.now()) {
  const distribution = getSocialDistribution(settings);

  const result = Object.entries(distribution).flatMap(([region, count]) => {
    const bucket = filterOldNews(socialTrends?.[region] || [], freshnessLimitHours, now)
      .sort((a, b) => getTimestamp(b) - getTimestamp(a))
      .slice(0, count);

    return bucket.map(item => ({
      ...item,
      region,
      regionLabel: SOCIAL_REGION_LABELS[region] || region,
    }));
  });

  return result.sort((a, b) => getTimestamp(b) - getTimestamp(a));
}

function getTechCards(data = {}, freshnessLimitHours, maxCount = 20, now = Date.now()) {
  return filterOldNews(data.techCards || [], freshnessLimitHours, now).slice(0, maxCount);
}

function getAiCards(data = {}, freshnessLimitHours, maxCount = 20, now = Date.now()) {
  return filterOldNews(data.aiCards || [], freshnessLimitHours, now).slice(0, maxCount);
}

function getVisibleCounts({ entertainmentByRegion, socialTrends, techCards, aiCards }) {
  return {
    entertainment: Object.values(entertainmentByRegion || {}).reduce(
      (sum, items) => sum + (Array.isArray(items) ? items.length : 0),
      0
    ),
    social: Array.isArray(socialTrends) ? socialTrends.length : 0,
    tech: Array.isArray(techCards) ? techCards.length : 0,
    ai: Array.isArray(aiCards) ? aiCards.length : 0,
  };
}

export function useBuzzTabViewModel() {
  const {
    envelope,
    loading,
    error: datasetError,
    reload: reloadDataset,
  } = useDataset('buzz');

  const settingsContext = useSettings();
  const settings = settingsContext?.settings || EMPTY_SETTINGS;

  const freshnessLimitHours = settings?.freshnessLimitHours || 72;
  const buzzData = envelope?.data || EMPTY_BUZZ_DATA;

  const reload = useCallback((force = true) => {
    return reloadDataset(force);
  }, [reloadDataset]);

  const computed = useMemo(() => {
    const entertainmentByRegion = normalizeEntertainment(
      buzzData.entertainment || {},
      freshnessLimitHours
    );

    const socialTrends = flattenSocialTrends(
      buzzData.socialTrends || {},
      settings || {},
      freshnessLimitHours
    );

    const techCards = getTechCards(
      buzzData,
      freshnessLimitHours,
      settings?.sections?.technology?.count || 20
    );

    const aiCards = getAiCards(
      buzzData,
      freshnessLimitHours,
      20
    );

    const visibleCounts = getVisibleCounts({
      entertainmentByRegion,
      socialTrends,
      techCards,
      aiCards,
    });

    const navSections = [
      { id: 'entertainment', icon: '🎬', label: 'Entertainment' },
      { id: 'social-trends', icon: '👥', label: 'Social Trends' },
      { id: 'tech-news', icon: '🚀', label: 'Tech & Startups' },
      { id: 'ai-innovation', icon: '🤖', label: 'AI & Innovation' },
    ];

    return {
      entertainmentTabs: ENTERTAINMENT_TABS,
      entertainmentByRegion,
      socialTrends,
      techCards,
      aiCards,
      visibleCounts,
      navSections,
      technologyMaxDisplay: settings?.sections?.technology?.count || 5,
    };
  }, [buzzData, freshnessLimitHours, settings]);

  const error = datasetError || envelope?.error || null;

  return {
    envelope,
    buzzData,
    loading,
    error,
    reload,
    source: envelope?.source || null,
    freshness: envelope?.freshness || null,
    slo: envelope?.slo || null,
    warnings: [
      ...(Array.isArray(envelope?.validation?.warnings) ? envelope.validation.warnings : []),
      ...(Array.isArray(envelope?.slo?.warnings) ? envelope.slo.warnings : []),
    ],
    diagnostics: envelope?.diagnostics || [],
    ...computed,
  };
}

export const __buzzViewModelInternalsForTest = {
  ENTERTAINMENT_TABS,
  SOCIAL_REGION_LABELS,
  DEFAULT_SOCIAL_COUNTS,
  getTimestamp,
  filterOldNews,
  normalizeEntertainment,
  getSocialDistribution,
  flattenSocialTrends,
  getTechCards,
  getAiCards,
  getVisibleCounts,
};

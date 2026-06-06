import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWeather } from '../context/WeatherContext';
import { useNews } from '../context/NewsContext';
import { useMarket } from '../context/MarketContext';
import { getTimeSinceRefresh, setLastRefresh } from '../utils/storage';
import { getCurrentSegment, getRecommendedToggles } from '../utils/timeSegment';

const REFRESH_SECTION_CONFIG = [
  { key: 'world', icon: '🌐', label: 'World News', desc: 'International headlines' },
  { key: 'india', icon: '🇮🇳', label: 'India News', desc: 'National news' },
  { key: 'chennai', icon: '🏛️', label: 'Chennai News', desc: 'Chennai city updates' },
  { key: 'trichy', icon: '🏛️', label: 'Trichy News', desc: 'Trichy local news' },
  { key: 'local', icon: '📍', label: 'Local (Muscat)', desc: 'Muscat & Oman news' },
  { key: 'social', icon: '👥', label: 'Social Trends', desc: 'Trending topics' },
  { key: 'weather', icon: '☁️', label: 'Weather', desc: 'Chennai, Trichy, Muscat' },
  { key: 'market', icon: '📈', label: 'Market', desc: 'BSE, NSE, Movers' },
];

function getSelectedRefreshSections(refreshToggles) {
  return Object.keys(refreshToggles || {}).filter(key => refreshToggles[key]);
}

function makeToggleState(value) {
  return {
    world: value,
    india: value,
    chennai: value,
    trichy: value,
    local: value,
    social: value,
    weather: value,
    market: value,
  };
}

function getRefreshOutcome(results) {
  const failed = results.filter(result => result.status === 'rejected');
  const fulfilled = results.filter(result => result.status === 'fulfilled');

  if (failed.length === 0) {
    return {
      ok: true,
      degraded: false,
      failed: [],
      results,
    };
  }

  if (fulfilled.length > 0) {
    return {
      ok: true,
      degraded: true,
      failed: failed.map(result => result.reason?.message || String(result.reason)),
      results,
    };
  }

  return {
    ok: false,
    degraded: false,
    failed: failed.map(result => result.reason?.message || String(result.reason)),
    results,
  };
}

function callRefresh(callback, ...args) {
  try {
    if (typeof callback !== 'function') {
      return Promise.reject(new Error('Refresh handler unavailable.'));
    }

    return Promise.resolve(callback(...args));
  } catch (error) {
    return Promise.reject(error);
  }
}

export function useRefreshPageViewModel() {
  const navigate = useNavigate();

  const { refreshWeather } = useWeather();
  const { refreshNews } = useNews();
  const { refreshMarket } = useMarket();

  const [refreshToggles, setRefreshToggles] = useState(() => (
    getRecommendedToggles(getCurrentSegment())
  ));

  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefreshTime] = useState(() => getTimeSinceRefresh());
  const [lastError, setLastError] = useState(null);

  const recommended = useMemo(() => (
    getRecommendedToggles(getCurrentSegment())
  ), []);

  const sectionConfig = useMemo(() => REFRESH_SECTION_CONFIG, []);

  const selectedSections = useMemo(() => (
    getSelectedRefreshSections(refreshToggles)
  ), [refreshToggles]);

  const selectedCount = selectedSections.length;

  const currentSegment = useMemo(() => (
    getCurrentSegment()
  ), []);

  const updateSectionToggle = useCallback((key, value) => {
    setRefreshToggles(prev => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const toggleAll = useCallback((value) => {
    setRefreshToggles(makeToggleState(value));
  }, []);

  const refreshSelectedSections = useCallback(async () => {
    setLoading(true);
    setLastError(null);

    const sectionsToRefresh = getSelectedRefreshSections(refreshToggles);
    const promises = [];
    const newsSections = [];
    const touchedSections = [];

    sectionsToRefresh.forEach(key => {
      if (key === 'weather') {
        promises.push(callRefresh(refreshWeather, true));
        touchedSections.push('weather');
      } else if (key === 'market') {
        promises.push(callRefresh(refreshMarket));
        touchedSections.push('market');
      } else {
        newsSections.push(key);
        touchedSections.push(key);
      }
    });

    if (newsSections.length > 0) {
      promises.push(callRefresh(refreshNews, newsSections));
    }

    try {
      const results = await Promise.allSettled(promises);
      const outcome = getRefreshOutcome(results);

      touchedSections.forEach(section => setLastRefresh(section));
      setLastRefreshTime('Just now');

      if (!outcome.ok || outcome.degraded) {
        setLastError(outcome.failed.join('; '));
      }

      if (outcome.ok) {
        setTimeout(() => navigate('/'), 500);
      }

      return outcome;
    } catch (error) {
      const message = error?.message || String(error);

      setLastError(message);

      return {
        ok: false,
        degraded: false,
        failed: [message],
        results: [],
      };
    } finally {
      setLoading(false);
    }
  }, [
    navigate,
    refreshMarket,
    refreshNews,
    refreshToggles,
    refreshWeather,
  ]);

  return {
    refreshToggles,
    loading,
    lastRefresh,
    lastError,
    recommended,
    sectionConfig,
    selectedCount,
    currentSegment,
    updateSectionToggle,
    toggleAll,
    refreshSelectedSections,
  };
}

export const __refreshPageViewModelInternalsForTest = {
  REFRESH_SECTION_CONFIG,
  getSelectedRefreshSections,
  makeToggleState,
  getRefreshOutcome,
  callRefresh,
};

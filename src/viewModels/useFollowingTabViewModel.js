import { useCallback, useMemo } from 'react';
import { useDataset } from '../data/orchestrator/useDataset.js';
import { useTopics } from '../context/TopicContext.jsx';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function normalizeSuggestion(value) {
  if (typeof value === 'string') {
    const word = value.trim();

    return word
      ? {
          word,
          query: word,
        }
      : null;
  }

  if (value && typeof value === 'object') {
    const word = String(value.word || value.query || value.name || value.label || '').trim();

    if (!word) return null;

    return {
      ...value,
      word,
      query: value.query || word,
    };
  }

  return null;
}

function normalizeSuggestions(value) {
  return asArray(value)
    .map(normalizeSuggestion)
    .filter(Boolean);
}

function getTopicArticles(topicNews, topicId) {
  return asArray(asRecord(topicNews)[topicId]);
}

function getTopicArticleCount(topicNews, topicId) {
  return getTopicArticles(topicNews, topicId).length;
}

function getTopicLastFetchedTime(topic) {
  if (!topic?.lastFetched) return 0;

  const timestamp = new Date(topic.lastFetched).getTime();

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getTopicStats(followedTopics = [], topicNews = {}) {
  const topics = asArray(followedTopics);
  const news = asRecord(topicNews);

  const topicCount = topics.length;
  const articleCount = topics.reduce((sum, topic) => {
    return sum + getTopicArticleCount(news, topic.id);
  }, 0);

  const activeCount = topics.filter(topic => getTopicArticleCount(news, topic.id) > 0).length;
  const newCount = topics.filter(topic => !topic.lastFetched).length;

  return {
    topicCount,
    articleCount,
    activeCount,
    newCount,
  };
}

function sortFollowedTopics(followedTopics = [], topicNews = {}) {
  const topics = asArray(followedTopics);
  const news = asRecord(topicNews);

  return [...topics].sort((a, b) => {
    const aCount = getTopicArticleCount(news, a.id);
    const bCount = getTopicArticleCount(news, b.id);

    if (bCount !== aCount) return bCount - aCount;

    return getTopicLastFetchedTime(b) - getTopicLastFetchedTime(a);
  });
}

function makeSuggestionTopic(word) {
  const query = String(word || '').trim();

  return {
    name: query,
    query,
    icon: '🔍',
    options: {
      country: 'IN',
      lang: 'en',
      timeRange: '30d',
    },
  };
}

function getProjectedFollowingData({
  envelope,
  contextFollowedTopics,
  contextTopicNews,
  contextSuggestions,
}) {
  const data = asRecord(envelope?.data);

  const datasetFollowedTopics = asArray(data.followedTopics);
  const datasetTopicNews = asRecord(data.topicNews);
  const datasetSuggestions = normalizeSuggestions(data.suggestions);

  return {
    followedTopics: datasetFollowedTopics.length > 0
      ? datasetFollowedTopics
      : asArray(contextFollowedTopics),

    topicNews: Object.keys(datasetTopicNews).length > 0
      ? datasetTopicNews
      : asRecord(contextTopicNews),

    suggestions: datasetSuggestions.length > 0
      ? datasetSuggestions
      : normalizeSuggestions(contextSuggestions),
  };
}

function getFollowingBoundaryEnvelope({
  envelope,
  followedTopics,
  topicNews,
  suggestions,
}) {
  const data = {
    followedTopics: asArray(followedTopics),
    topicNews: asRecord(topicNews),
    suggestions: normalizeSuggestions(suggestions),
  };

  if (envelope) {
    return {
      ...envelope,
      data: {
        ...asRecord(envelope.data),
        ...data,
      },
      diagnostics: [
        ...asArray(envelope.diagnostics),
        {
          event: 'following.view_model.projected_data',
          severity: 'info',
          message: 'Following ViewModel projected display data from dataset/context sources.',
        },
      ],
    };
  }

  return {
    ok: true,
    datasetId: 'following',
    data,
    source: 'context',
    freshness: data.followedTopics.length > 0 ? 'fresh' : 'empty',
    validation: {
      passed: true,
      errors: [],
      warnings: [],
    },
    diagnostics: [
      {
        event: 'following.view_model.context_fallback',
        severity: 'info',
        message: 'Following page is using TopicContext projection while dataset envelope is unavailable.',
      },
    ],
  };
}

function getRefreshFailure(results) {
  const rejected = results.find(result => result.status === 'rejected');

  if (rejected) {
    return rejected.reason?.message || String(rejected.reason);
  }

  const failedEnvelope = results.find(result => (
    result.status === 'fulfilled' &&
    result.value &&
    typeof result.value === 'object' &&
    result.value.ok === false
  ));

  if (failedEnvelope) {
    return failedEnvelope.value.error || 'Following refresh returned degraded data';
  }

  return null;
}

export function useFollowingTabViewModel() {
  const {
    envelope,
    loading: datasetLoading,
    error: datasetError,
    reload: reloadDataset,
  } = useDataset('following');

  const {
    followedTopics,
    topicNews,
    loading: topicLoading,
    suggestions,
    topicMessage,
    addTopic,
    removeTopic,
    refreshTopics,
    clearTopicMessage,
  } = useTopics();

  const projected = useMemo(() => getProjectedFollowingData({
    envelope,
    contextFollowedTopics: followedTopics,
    contextTopicNews: topicNews,
    contextSuggestions: suggestions,
  }), [envelope, followedTopics, topicNews, suggestions]);

  const safeFollowedTopics = projected.followedTopics;
  const safeTopicNews = projected.topicNews;
  const safeSuggestions = projected.suggestions;

  const stats = useMemo(
    () => getTopicStats(safeFollowedTopics, safeTopicNews),
    [safeFollowedTopics, safeTopicNews]
  );

  const sortedTopics = useMemo(
    () => sortFollowedTopics(safeFollowedTopics, safeTopicNews),
    [safeFollowedTopics, safeTopicNews]
  );

  const boundaryEnvelope = useMemo(() => getFollowingBoundaryEnvelope({
    envelope,
    followedTopics: safeFollowedTopics,
    topicNews: safeTopicNews,
    suggestions: safeSuggestions,
  }), [envelope, safeFollowedTopics, safeTopicNews, safeSuggestions]);

  const refresh = useCallback(async (shouldNotify = false) => {
    const results = await Promise.allSettled([
      reloadDataset(true),
      refreshTopics(shouldNotify),
    ]);

    const failure = getRefreshFailure(results);

    if (failure) {
      return {
        ok: false,
        error: failure,
        results,
      };
    }

    return {
      ok: true,
      results,
    };
  }, [refreshTopics, reloadDataset]);

  const handleSuggestionClick = useCallback((word) => {
    const topic = makeSuggestionTopic(word);

    if (!topic.query) {
      return {
        ok: false,
        reason: 'empty-suggestion',
      };
    }

    return addTopic(topic);
  }, [addTopic]);

  const getArticlesForTopic = useCallback((topicId) => {
    return getTopicArticles(safeTopicNews, topicId);
  }, [safeTopicNews]);

  const getArticleCountForTopic = useCallback((topicId) => {
    return getTopicArticleCount(safeTopicNews, topicId);
  }, [safeTopicNews]);

  const loading = Boolean(datasetLoading || topicLoading);
  const error = datasetError || boundaryEnvelope?.error || null;

  return {
    envelope: boundaryEnvelope,
    datasetEnvelope: envelope,
    followedTopics: safeFollowedTopics,
    topicNews: safeTopicNews,
    sortedTopics,
    suggestions: safeSuggestions,
    topicMessage,
    stats,
    hasTopics: safeFollowedTopics.length > 0,
    loading,
    error,
    refresh,
    addTopic,
    removeTopic,
    clearTopicMessage,
    handleSuggestionClick,
    getArticlesForTopic,
    getArticleCountForTopic,
    source: boundaryEnvelope?.source || null,
    freshness: boundaryEnvelope?.freshness || null,
    slo: boundaryEnvelope?.slo || null,
    warnings: [
      ...(Array.isArray(boundaryEnvelope?.validation?.warnings) ? boundaryEnvelope.validation.warnings : []),
      ...(Array.isArray(boundaryEnvelope?.slo?.warnings) ? boundaryEnvelope.slo.warnings : []),
    ],
    diagnostics: boundaryEnvelope?.diagnostics || [],
  };
}

export const __followingViewModelInternalsForTest = {
  asArray,
  asRecord,
  normalizeSuggestion,
  normalizeSuggestions,
  getTopicArticles,
  getTopicArticleCount,
  getTopicLastFetchedTime,
  getTopicStats,
  sortFollowedTopics,
  makeSuggestionTopic,
  getProjectedFollowingData,
  getFollowingBoundaryEnvelope,
  getRefreshFailure,
};

import {
  makeEnvelope,
  ENVELOPE_SOURCES,
  ENVELOPE_FRESHNESS,
} from '../dataEnvelope.js';
import { applyDatasetSlo } from '../slo/applyDatasetSlo.js';
import { getSettings } from '../../utils/storage.js';
import { fetchAllTopicsNews } from '../../services/topicService.js';

function safeGetSettings() {
  try {
    return getSettings?.() || {};
  } catch {
    return {};
  }
}

function getTopicKey(topic) {
  return String(topic?.query || topic?.name || '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ');
}

function findDuplicateTopics(topics = []) {
  const seen = new Map();
  const duplicates = [];

  topics.forEach(topic => {
    const key = getTopicKey(topic);
    if (!key) return;

    if (seen.has(key)) {
      duplicates.push({
        key,
        firstId: seen.get(key),
        duplicateId: topic.id,
      });
      return;
    }

    seen.set(key, topic.id);
  });

  return duplicates;
}

function unwrapTopicResult(value) {
  if (Array.isArray(value)) {
    return {
      ok: true,
      articles: value,
      error: null,
    };
  }

  if (value?.ok === true && Array.isArray(value.data)) {
    return {
      ok: true,
      articles: value.data,
      error: null,
    };
  }

  return {
    ok: false,
    articles: [],
    error: value?.error || 'topic refresh failed',
  };
}

export async function load() {
  const settings = safeGetSettings();
  const followedTopics = Array.isArray(settings.followedTopics) ? settings.followedTopics : [];
  const duplicateTopics = findDuplicateTopics(followedTopics);

  if (followedTopics.length === 0) {
    return applyDatasetSlo(makeEnvelope({
      ok: true,
      datasetId: 'following',
      data: {
        followedTopics: [],
        topicNews: {},
        failedTopics: [],
        notificationState: {
          enabled: settings.topicNotifications !== false,
        },
        duplicateTopics: [],
        raw: {
          settings,
          rawTopicNews: {},
        },
      },
      source: ENVELOPE_SOURCES.CACHE,
      freshness: ENVELOPE_FRESHNESS.EMPTY,
      validation: {
        passed: true,
        errors: [],
        warnings: ['following_empty'],
      },
      diagnostics: [
        {
          event: 'followingDataset.empty',
          severity: 'info',
          message: 'No followed topics configured',
        },
      ],
    }));
  }

  let rawTopicNews = {};

  try {
    rawTopicNews = await fetchAllTopicsNews(followedTopics);
  } catch (error) {
    return applyDatasetSlo(makeEnvelope({
      ok: false,
      datasetId: 'following',
      data: {
        followedTopics,
        topicNews: {},
        failedTopics: followedTopics.map(topic => ({
          topicId: topic.id,
          topicName: topic.name,
          error: error?.message || String(error),
        })),
        notificationState: {
          enabled: settings.topicNotifications !== false,
        },
        duplicateTopics,
        raw: {
          settings,
          rawTopicNews: {},
        },
      },
      source: ENVELOPE_SOURCES.FAILED,
      freshness: ENVELOPE_FRESHNESS.UNKNOWN,
      error: error?.message || String(error),
      validation: {
        passed: false,
        errors: ['following_fetch_failed'],
        warnings: duplicateTopics.map(topic => `duplicate_topic:${topic.key}`),
      },
      diagnostics: [
        {
          event: 'followingDataset.fetch_failed',
          severity: 'error',
          message: error?.message || String(error),
        },
      ],
    }));
  }

  const topicNews = {};
  const failedTopics = [];

  followedTopics.forEach(topic => {
    const unwrapped = unwrapTopicResult(rawTopicNews[topic.id]);

    topicNews[topic.id] = unwrapped.articles;

    if (!unwrapped.ok) {
      failedTopics.push({
        topicId: topic.id,
        topicName: topic.name,
        error: unwrapped.error,
      });
    }
  });

  const ok = failedTopics.length < followedTopics.length;

  const envelope = makeEnvelope({
    ok,
    datasetId: 'following',
    data: {
      followedTopics,
      topicNews,
      failedTopics,
      notificationState: {
        enabled: settings.topicNotifications !== false,
      },
      duplicateTopics,
      raw: {
        settings,
        rawTopicNews,
      },
    },
    source: failedTopics.length ? ENVELOPE_SOURCES.CACHE : ENVELOPE_SOURCES.LIVE,
    freshness: ok ? ENVELOPE_FRESHNESS.FRESH : ENVELOPE_FRESHNESS.UNKNOWN,
    error: ok ? null : 'all followed topics failed',
    validation: {
      passed: ok,
      errors: ok ? [] : ['following_all_topics_failed'],
      warnings: [
        ...failedTopics.map(topic => `topic_failed:${topic.topicName || topic.topicId}`),
        ...duplicateTopics.map(topic => `duplicate_topic:${topic.key}`),
      ],
    },
    diagnostics: [
      {
        event: 'followingDataset.loaded',
        severity: ok ? 'info' : 'warn',
        message: `Following dataset loaded with ${followedTopics.length} topic(s)`,
        details: {
          failedTopicCount: failedTopics.length,
          duplicateTopicCount: duplicateTopics.length,
        },
      },
    ],
  });

  return applyDatasetSlo(envelope);
}

export const __followingDatasetInternalsForTest = {
  findDuplicateTopics,
  unwrapTopicResult,
};

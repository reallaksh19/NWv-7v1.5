import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../utils/topicQueryBuilder.js', () => ({
  buildTopicQuery: vi.fn(() => 'mock-feed-url'),
}));

vi.mock('./rssAggregator.js', () => ({
  fetchAndParseFeed: vi.fn(),
}));

vi.mock('../utils/storage.js', () => ({
  updateTopicLastFetched: vi.fn(),
  getSettings: vi.fn(() => ({
    hideOlderThanHours: 60,
    strictFreshness: true,
  })),
}));

import { buildTopicQuery } from '../utils/topicQueryBuilder.js';
import { fetchAndParseFeed } from './rssAggregator.js';
import { getSettings, updateTopicLastFetched } from '../utils/storage.js';
import { fetchAllTopicsNews, fetchTopicNews } from './topicService.js';

describe('fetchTopicNews envelope behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildTopicQuery.mockReturnValue('mock-feed-url');
    getSettings.mockReturnValue({
      hideOlderThanHours: 60,
      strictFreshness: true,
    });
  });

  it('returns ok:true envelope on success', async () => {
    fetchAndParseFeed.mockResolvedValue([
      {
        id: 'a1',
        title: 'Story',
        publishedAt: Date.now(),
      },
    ]);

    const env = await fetchTopicNews({
      id: 'topic-1',
      name: 'AI',
      query: 'AI',
    });

    expect(env.ok).toBe(true);
    expect(env.datasetId).toBe('topic:topic-1');
    expect(env.source).toBe('live');
    expect(env.freshness).toBe('fresh');
    expect(env.data).toHaveLength(1);
    expect(env.data[0].topicId).toBe('topic-1');
    expect(updateTopicLastFetched).toHaveBeenCalledWith('topic-1');
  });

  it('returns ok:true empty envelope when success has no articles', async () => {
    fetchAndParseFeed.mockResolvedValue([]);

    const env = await fetchTopicNews({
      id: 'topic-1',
      name: 'AI',
      query: 'AI',
    });

    expect(env.ok).toBe(true);
    expect(env.source).toBe('live');
    expect(env.freshness).toBe('empty');
    expect(env.validation.warnings).toContain('topic_returned_no_articles');
  });

  it('returns ok:false envelope on RSS failure', async () => {
    fetchAndParseFeed.mockRejectedValue(new Error('RSS down'));

    const env = await fetchTopicNews({
      id: 'topic-1',
      name: 'AI',
      query: 'AI',
    });

    expect(env.ok).toBe(false);
    expect(env.source).toBe('failed');
    expect(env.error).toContain('RSS down');
    expect(env.validation.passed).toBe(false);
    expect(env.diagnostics[0].event).toBe('topic_fetch_failed');
  });

  it('returns ok:false envelope for malformed topic instead of throwing', async () => {
    const env = await fetchTopicNews(undefined);

    expect(env.ok).toBe(false);
    expect(env.datasetId).toBe('topic:unknown');
    expect(env.source).toBe('failed');
    expect(env.error).toBe('Invalid topic: missing query/name');
    expect(fetchAndParseFeed).not.toHaveBeenCalled();
  });

  it('falls back to default settings if getSettings returns null', async () => {
    getSettings.mockReturnValue(null);
    fetchAndParseFeed.mockResolvedValue([
      {
        id: 'a1',
        title: 'Story',
        publishedAt: Date.now(),
      },
    ]);

    const env = await fetchTopicNews({
      id: 'topic-1',
      name: 'AI',
      query: 'AI',
    });

    expect(env.ok).toBe(true);
    expect(env.data).toHaveLength(1);
  });

  it('fetchAllTopicsNews uses allSettled-compatible behavior and preserves failed envelopes', async () => {
    fetchAndParseFeed
      .mockResolvedValueOnce([
        {
          id: 'a1',
          title: 'Story',
          publishedAt: Date.now(),
        },
      ])
      .mockRejectedValueOnce(new Error('RSS down'));

    const result = await fetchAllTopicsNews([
      { id: 'topic-1', name: 'AI', query: 'AI' },
      { id: 'topic-2', name: 'Markets', query: 'Markets' },
    ]);

    expect(Array.isArray(result['topic-1'])).toBe(true);
    expect(result['topic-1']).toHaveLength(1);

    expect(result['topic-2'].ok).toBe(false);
    expect(result['topic-2'].source).toBe('failed');
    expect(result['topic-2'].error).toContain('RSS down');
  });
});

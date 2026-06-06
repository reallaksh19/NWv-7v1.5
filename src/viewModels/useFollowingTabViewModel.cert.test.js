import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import {
  __followingViewModelInternalsForTest,
} from './useFollowingTabViewModel.js';

const {
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
} = __followingViewModelInternalsForTest;

describe('useFollowingTabViewModel static checks', () => {
  const src = fs.readFileSync('src/viewModels/useFollowingTabViewModel.js', 'utf8');

  it('uses following dataset and TopicContext', () => {
    expect(src).toContain("useDataset('following')");
    expect(src).toContain('useTopics');
  });

  it('owns page projection helpers', () => {
    expect(src).toContain('getTopicStats');
    expect(src).toContain('sortFollowedTopics');
    expect(src).toContain('makeSuggestionTopic');
    expect(src).toContain('handleSuggestionClick');
  });

  it('projects dataset data before context fallback', () => {
    expect(src).toContain('getProjectedFollowingData');
    expect(src).toContain('datasetFollowedTopics.length > 0');
    expect(src).toContain('Object.keys(datasetTopicNews).length > 0');
  });

  it('normalizes suggestions before page consumption', () => {
    expect(src).toContain('normalizeSuggestion');
    expect(src).toContain('normalizeSuggestions');
  });

  it('detects failed fulfilled refresh envelopes', () => {
    expect(src).toContain('getRefreshFailure');
    expect(src).toContain('result.value.ok === false');
  });

  it('routes refresh through dataset reload and TopicContext refresh', () => {
    expect(src).toContain('Promise.allSettled');
    expect(src).toContain('reloadDataset(true)');
    expect(src).toContain('refreshTopics(shouldNotify)');
  });
});

describe('Following ViewModel internals', () => {
  it('normalizes arrays and records', () => {
    expect(asArray(null)).toEqual([]);
    expect(asArray([1])).toEqual([1]);
    expect(asRecord(null)).toEqual({});
    expect(asRecord({ a: 1 })).toEqual({ a: 1 });
  });

  it('normalizes string suggestions', () => {
    expect(normalizeSuggestion('AI')).toEqual({
      word: 'AI',
      query: 'AI',
    });
  });

  it('normalizes object suggestions', () => {
    expect(normalizeSuggestion({ query: 'EV', icon: '⚡' })).toEqual({
      query: 'EV',
      icon: '⚡',
      word: 'EV',
    });
  });

  it('drops empty suggestions', () => {
    expect(normalizeSuggestion('')).toBe(null);
    expect(normalizeSuggestion({})).toBe(null);
    expect(normalizeSuggestions(['AI', '', { label: 'Markets' }])).toEqual([
      {
        word: 'AI',
        query: 'AI',
      },
      {
        label: 'Markets',
        word: 'Markets',
        query: 'Markets',
      },
    ]);
  });

  it('returns topic articles safely', () => {
    expect(getTopicArticles({ t1: [{ title: 'A' }] }, 't1')).toHaveLength(1);
    expect(getTopicArticles({ t1: null }, 't1')).toEqual([]);
  });

  it('counts topic articles safely', () => {
    expect(getTopicArticleCount({ t1: [{ title: 'A' }] }, 't1')).toBe(1);
    expect(getTopicArticleCount({}, 'missing')).toBe(0);
  });

  it('parses topic last fetched time safely', () => {
    expect(getTopicLastFetchedTime({ lastFetched: '2026-05-28T10:00:00Z' })).toBeGreaterThan(0);
    expect(getTopicLastFetchedTime({ lastFetched: 'bad-date' })).toBe(0);
    expect(getTopicLastFetchedTime({})).toBe(0);
  });

  it('computes topic stats', () => {
    const topics = [
      { id: 'a', lastFetched: '2026-05-28T10:00:00Z' },
      { id: 'b' },
      { id: 'c', lastFetched: '2026-05-28T09:00:00Z' },
    ];

    const news = {
      a: [{ title: 'A1' }, { title: 'A2' }],
      c: [{ title: 'C1' }],
    };

    expect(getTopicStats(topics, news)).toEqual({
      topicCount: 3,
      articleCount: 3,
      activeCount: 2,
      newCount: 1,
    });
  });

  it('sorts topics by article count then last fetched recency', () => {
    const topics = [
      { id: 'old', lastFetched: '2026-05-20T10:00:00Z' },
      { id: 'hot', lastFetched: '2026-05-19T10:00:00Z' },
      { id: 'newer', lastFetched: '2026-05-28T10:00:00Z' },
    ];

    const news = {
      hot: [{ title: 'A' }, { title: 'B' }],
      newer: [{ title: 'C' }],
      old: [{ title: 'D' }],
    };

    const sorted = sortFollowedTopics(topics, news);

    expect(sorted.map(topic => topic.id)).toEqual(['hot', 'newer', 'old']);
  });

  it('builds suggestion topic payload', () => {
    expect(makeSuggestionTopic('AI').query).toBe('AI');
    expect(makeSuggestionTopic('AI').options).toEqual({
      country: 'IN',
      lang: 'en',
      timeRange: '30d',
    });
  });

  it('prefers dataset data over context data', () => {
    const result = getProjectedFollowingData({
      envelope: {
        data: {
          followedTopics: [{ id: 'dataset-topic' }],
          topicNews: {
            'dataset-topic': [{ title: 'Dataset' }],
          },
          suggestions: ['Dataset suggestion'],
        },
      },
      contextFollowedTopics: [{ id: 'context-topic' }],
      contextTopicNews: {
        'context-topic': [{ title: 'Context' }],
      },
      contextSuggestions: ['Context suggestion'],
    });

    expect(result.followedTopics[0].id).toBe('dataset-topic');
    expect(result.topicNews['dataset-topic']).toHaveLength(1);
    expect(result.suggestions[0].word).toBe('Dataset suggestion');
  });

  it('falls back to context data when dataset data is empty', () => {
    const result = getProjectedFollowingData({
      envelope: {
        data: {},
      },
      contextFollowedTopics: [{ id: 'context-topic' }],
      contextTopicNews: {
        'context-topic': [{ title: 'Context' }],
      },
      contextSuggestions: ['Context suggestion'],
    });

    expect(result.followedTopics[0].id).toBe('context-topic');
    expect(result.topicNews['context-topic']).toHaveLength(1);
    expect(result.suggestions[0].word).toBe('Context suggestion');
  });

  it('builds fallback boundary envelope when dataset envelope is missing', () => {
    const result = getFollowingBoundaryEnvelope({
      envelope: null,
      followedTopics: [{ id: 'a' }],
      topicNews: { a: [{ title: 'A' }] },
      suggestions: [{ word: 'AI' }],
    });

    expect(result.ok).toBe(true);
    expect(result.datasetId).toBe('following');
    expect(result.data.followedTopics).toHaveLength(1);
    expect(result.freshness).toBe('fresh');
  });

  it('projects display data into existing dataset boundary envelope', () => {
    const result = getFollowingBoundaryEnvelope({
      envelope: {
        ok: false,
        datasetId: 'following',
        data: {
          existing: true,
        },
        diagnostics: [
          {
            event: 'dataset.original',
            severity: 'info',
            message: 'original',
          },
        ],
      },
      followedTopics: [{ id: 'a' }],
      topicNews: { a: [{ title: 'A' }] },
      suggestions: ['AI'],
    });

    expect(result.ok).toBe(false);
    expect(result.data.existing).toBe(true);
    expect(result.data.followedTopics).toHaveLength(1);
    expect(result.data.suggestions[0].word).toBe('AI');
    expect(result.diagnostics.some(item => item.event === 'following.view_model.projected_data')).toBe(true);
  });

  it('detects rejected refresh promise', () => {
    const failure = getRefreshFailure([
      {
        status: 'rejected',
        reason: new Error('Network failed'),
      },
    ]);

    expect(failure).toBe('Network failed');
  });

  it('detects fulfilled failed dataset refresh envelope', () => {
    const failure = getRefreshFailure([
      {
        status: 'fulfilled',
        value: {
          ok: false,
          error: 'Dataset failed',
        },
      },
    ]);

    expect(failure).toBe('Dataset failed');
  });

  it('returns null for successful refresh results', () => {
    const failure = getRefreshFailure([
      {
        status: 'fulfilled',
        value: {
          ok: true,
        },
      },
      {
        status: 'fulfilled',
        value: undefined,
      },
    ]);

    expect(failure).toBe(null);
  });
});

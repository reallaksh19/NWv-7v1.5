import { describe, expect, it } from 'vitest';
import { evaluateFollowingSlo } from './followingSlo.js';

describe('followingSlo', () => {
  it('passes with warning when following list is empty', () => {
    const result = evaluateFollowingSlo({
      followedTopics: [],
      topicNews: {},
      failedTopics: [],
    });

    expect(result.passed).toBe(true);
    expect(result.warnings).toContain('following_empty_list');
  });

  it('fails when all followed topics fail', () => {
    const result = evaluateFollowingSlo({
      followedTopics: [
        { id: 't1', name: 'Topic 1' },
        { id: 't2', name: 'Topic 2' },
      ],
      topicNews: {},
      failedTopics: [
        { topicId: 't1', topicName: 'Topic 1', error: 'failed' },
        { topicId: 't2', topicName: 'Topic 2', error: 'failed' },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('following_all_topics_failed');
  });

  it('fails when followed topics exist but zero articles returned', () => {
    const result = evaluateFollowingSlo({
      followedTopics: [{ id: 't1', name: 'Topic 1' }],
      topicNews: { t1: [] },
      failedTopics: [],
    });

    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('following_no_articles_returned');
  });

  it('warns when some topics fail but not all', () => {
    const result = evaluateFollowingSlo({
      followedTopics: [
        { id: 't1', name: 'Topic 1' },
        { id: 't2', name: 'Topic 2' },
      ],
      topicNews: {
        t1: [{ title: 'Article 1' }],
        t2: [],
      },
      failedTopics: [
        { topicId: 't2', topicName: 'Topic 2', error: 'failed' },
      ],
    });

    expect(result.passed).toBe(true);
    expect(result.warnings.some(w => w.startsWith('following_some_topics_failed'))).toBe(true);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { notifyTopicUpdates } from './TopicContext.jsx';

describe('TopicContext refresh notifications', () => {
  it('does not notify when refreshed articles are unchanged', () => {
    const notify = vi.fn();
    const followedTopics = [{ id: 'topic-1', name: 'Markets' }];
    const oldNews = {
      'topic-1': [{ id: 'rss-abc123', url: 'https://example.com/story' }],
    };
    const newNews = {
      'topic-1': [{ id: 'rss-abc123', url: 'https://example.com/story' }],
    };

    notifyTopicUpdates({
      newNews,
      oldNews,
      followedTopics,
      notify,
    });

    expect(notify).not.toHaveBeenCalled();
  });
});

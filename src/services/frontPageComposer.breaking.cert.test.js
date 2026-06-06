import { describe, expect, it } from 'vitest';
import { composeBalancedFeed } from './frontPageComposer.js';

// The legacy frontPageComposer.test.js (node custom-runner) is excluded from
// vitest; this cert test covers the L3 breaking-news pinning behavior.

const NOW = Date.now();

function article(id, section, impactScore, extra = {}) {
  return {
    id,
    title: `${section} story ${id}`,
    description: '',
    section,
    impactScore,
    publishedAt: NOW - 1000,
    ...extra,
  };
}

describe('composeBalancedFeed breaking pin (L3)', () => {
  it('pins a breaking story to the top even with a low impact score', () => {
    const articles = [
      article('n1', 'world', 20),
      article('n2', 'india', 18),
      article('n3', 'business', 16),
      article('n4', 'sports', 14),
      article('n5', 'technology', 12),
      article('n6', 'world', 10),
      // Low impact, but breaking — must surface at #1.
      article('b1', 'world', 0, { isBreaking: true, breakingScore: 6 }),
    ];

    const feed = composeBalancedFeed(articles, 10, 100, 100);

    expect(feed[0].id).toBe('b1');
    expect(feed.some(a => a.id === 'b1')).toBe(true);
  });

  it('ranks multiple breaking items by breaking score and dedupes', () => {
    const articles = [
      article('n1', 'world', 20),
      article('n2', 'india', 18),
      article('n3', 'business', 16),
      article('n4', 'sports', 14),
      article('n5', 'technology', 12),
      article('hi', 'world', 1, { isBreaking: true, breakingScore: 9 }),
      article('lo', 'india', 1, { isBreaking: true, breakingScore: 3 }),
    ];

    const feed = composeBalancedFeed(articles, 10, 100, 100);

    expect(feed[0].id).toBe('hi');
    expect(feed[1].id).toBe('lo');
    // No duplicate of the breaking items further down the feed.
    expect(feed.filter(a => a.id === 'hi')).toHaveLength(1);
  });
});

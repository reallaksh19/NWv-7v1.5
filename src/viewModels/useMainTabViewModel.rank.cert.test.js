import { describe, expect, it } from 'vitest';
import { __mainViewModelInternalsForTest } from './useMainTabViewModel.js';

const { filterLatestStories } = __mainViewModelInternalsForTest;

describe('filterLatestStories — temporal decay sort (RC-2 fix)', () => {
  it('a slightly-lower-impact but much fresher story can outrank a stale one', () => {
    const now = Date.now();
    const stories = [
      { id: 'stale', impactScore: 20, publishedAt: now - 30 * 3_600_000 },
      { id: 'fresh', impactScore: 16, publishedAt: now - 1 * 3_600_000 },
    ];
    const out = filterLatestStories(stories, true);
    expect(out[0].id).toBe('fresh');
  });

  it('very stale high-impact story falls below a fresh moderate one', () => {
    const now = Date.now();
    const stories = [
      { id: 'old', impactScore: 100, publishedAt: now - 72 * 3_600_000 },
      { id: 'new', impactScore: 12, publishedAt: now - 2 * 3_600_000 },
    ];
    const out = filterLatestStories(stories, true);
    expect(out[0].id).toBe('new');
  });

  it('returns stories in their original order when custom sort is off', () => {
    const stories = [
      { id: 'a', impactScore: 5, publishedAt: Date.now() - 1000 },
      { id: 'b', impactScore: 10, publishedAt: Date.now() - 500 },
    ];
    expect(filterLatestStories(stories, false)).toBe(stories);
  });
});

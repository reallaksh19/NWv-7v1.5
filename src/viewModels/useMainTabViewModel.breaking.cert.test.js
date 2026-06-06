import { describe, expect, it } from 'vitest';
import { __mainViewModelInternalsForTest } from './useMainTabViewModel.js';

const { filterLatestStories } = __mainViewModelInternalsForTest;

describe('filterLatestStories breaking pin (L3)', () => {
  it('pins breaking news above higher-impact non-breaking stories', () => {
    const stories = [
      { id: 'a', impactScore: 50 },
      { id: 'b', impactScore: 40 },
      { id: 'breaking', impactScore: 1, isBreaking: true, breakingScore: 5 },
      { id: 'c', impactScore: 30 },
    ];

    const result = filterLatestStories(stories, true);

    expect(result[0].id).toBe('breaking');
    // Non-breaking stories keep impact-desc order after the pinned item.
    expect(result.slice(1).map(s => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('orders multiple breaking items by breaking score', () => {
    const stories = [
      { id: 'a', impactScore: 50 },
      { id: 'lowbreak', impactScore: 1, isBreaking: true, breakingScore: 2 },
      { id: 'highbreak', impactScore: 1, isBreaking: true, breakingScore: 8 },
    ];

    const result = filterLatestStories(stories, true);

    expect(result.slice(0, 2).map(s => s.id)).toEqual(['highbreak', 'lowbreak']);
  });

  it('still returns the raw list untouched when custom sort is disabled', () => {
    const stories = [{ id: 'x', isBreaking: true }, { id: 'y' }];
    expect(filterLatestStories(stories, false)).toBe(stories);
  });
});

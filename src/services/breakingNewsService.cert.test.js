import { describe, expect, it } from 'vitest';
import { isBreakingStory, mergeBreakingNews } from './breakingNewsService.js';

describe('breakingNewsService.isBreakingStory', () => {
  it('flags explicit isBreaking items', () => {
    expect(isBreakingStory({ isBreaking: true })).toBe(true);
  });

  it('flags items above the breaking-score floor', () => {
    expect(isBreakingStory({ breakingScore: 2 })).toBe(true);
    expect(isBreakingStory({ breakingScore: 1.5 })).toBe(false);
    expect(isBreakingStory({ breakingScore: 0 })).toBe(false);
  });

  it('treats nullish input safely', () => {
    expect(isBreakingStory(null)).toBe(false);
    expect(isBreakingStory(undefined)).toBe(false);
    expect(isBreakingStory({})).toBe(false);
  });
});

describe('breakingNewsService.mergeBreakingNews', () => {
  it('ranks by breaking score then recency', () => {
    const merged = mergeBreakingNews(
      [{ id: 'a', isBreaking: true, breakingScore: 2, publishedAt: 100 }],
      [{ id: 'b', isBreaking: true, breakingScore: 5, publishedAt: 50 }],
      5,
    );
    expect(merged.map(i => i.id)).toEqual(['b', 'a']);
  });

  it('dedupes by id with snapshot winning on conflicts', () => {
    const merged = mergeBreakingNews(
      [{ id: 'x', isBreaking: true, breakingScore: 9, source: 'client' }],
      [{ id: 'x', isBreaking: true, breakingScore: 4, source: 'snapshot' }],
      5,
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe('snapshot');
  });

  it('drops non-breaking items and honors the limit', () => {
    const merged = mergeBreakingNews(
      [{ id: 'n', breakingScore: 0 }],
      [
        { id: '1', isBreaking: true, breakingScore: 3 },
        { id: '2', isBreaking: true, breakingScore: 2 },
        { id: '3', isBreaking: true, breakingScore: 1.6 },
      ],
      2,
    );
    expect(merged.map(i => i.id)).toEqual(['1', '2']);
  });

  it('falls back to url/title keys when id is absent', () => {
    const merged = mergeBreakingNews(
      [{ url: 'https://x/a', isBreaking: true, breakingScore: 1.6 }],
      [{ url: 'https://x/a', isBreaking: true, breakingScore: 8 }],
      5,
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].breakingScore).toBe(8);
  });
});

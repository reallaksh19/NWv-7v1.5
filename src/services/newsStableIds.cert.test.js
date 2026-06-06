import { describe, expect, it } from 'vitest';
import { makeStableNewsId } from './newsService.js';
import { makeStableSlotStoryId } from '../adapters/newsFetcher.js';

describe('stable news article ids', () => {
  it('keeps RSS and DDG ids stable for the same article across fetches', () => {
    const article = {
      title: 'Same story',
      link: 'https://example.com/story?utm_source=x',
    };

    expect(makeStableNewsId('rss', article)).toBe(makeStableNewsId('rss', { ...article }));
    expect(makeStableNewsId('ddg', article)).toBe(makeStableNewsId('ddg', { ...article }));
  });

  it('keeps slot adapter ids stable for the same article across fetches', () => {
    const article = {
      title: 'Same slot story',
      url: 'https://example.com/slot-story',
    };

    expect(makeStableSlotStoryId('world', article)).toBe(makeStableSlotStoryId('world', { ...article }));
  });
});

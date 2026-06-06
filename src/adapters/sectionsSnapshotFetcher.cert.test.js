import { describe, expect, it } from 'vitest';
import {
  SECTION_SNAPSHOT_MAX_AGE_MS,
  getSectionsSnapshotRuntimeSummary,
  selectPrefetchedSectionItems,
} from './sectionsSnapshotFetcher';

const snapshot = {
  schemaVersion: 2,
  fetchedAt: Date.now(),
  contentHash: 'abc123',
  sectionQuality: {
    tn: {
      storyCount: 2,
      sourceGroupCount: 2,
      thin: false,
    },
  },
  sections: {
    tn: [
      {
        id: 'a',
        title: 'Chennai rain update',
        summary: 'Schools monitor weather after heavy rain.',
        url: 'https://example.com/a',
        source: 'The Hindu Chennai',
        sourceGroup: 'the_hindu',
        publishedAt: Date.now() - 1000,
      },
      {
        id: 'b',
        title: 'Tamil Nadu transport update',
        summary: 'Officials announced route changes.',
        url: 'https://example.com/b',
        source: 'DT Next',
        sourceGroup: 'dtnext',
        publishedAt: Date.now() - 2000,
      },
    ],
  },
};

describe('Sections snapshot browser ingestion certification', () => {
  it('summarizes section snapshot runtime quality', () => {
    const summary = getSectionsSnapshotRuntimeSummary(snapshot);

    expect(summary.supported).toBe(true);
    expect(summary.schemaVersion).toBe(2);
    expect(summary.hasSectionQuality).toBe(true);
    expect(summary.totalStories).toBe(2);
  });

  it('maps chennai requests to tn prefetched section', () => {
    const result = selectPrefetchedSectionItems(snapshot, 'chennai', 10);

    expect(result.sourceSection).toBe('tn');
    expect(result.items.length).toBe(2);
    expect(result.quality.sourceGroupCount).toBe(2);
    expect(result.items[0]._prefetchedSection).toBe(true);
    expect(result.items[0].section).toBe('chennai');
  });

  it('returns empty result for missing sections without throwing', () => {
    const result = selectPrefetchedSectionItems(snapshot, 'sports', 10);

    expect(result.items).toEqual([]);
    expect(result.sourceSection).toBe('sports');
  });

  it('maps social requests to technology prefetched section', () => {
    const socialSnapshot = {
      schemaVersion: 2,
      fetchedAt: Date.now(),
      sectionQuality: {
        technology: {
          storyCount: 1,
          sourceGroupCount: 1,
          thin: false,
        },
      },
      sections: {
        technology: [
          {
            title: 'Tech trend',
            summary: 'A technology story can back the social trend rail.',
            url: 'https://example.com/tech',
            source: 'Tech Source',
            publishedAt: Date.now(),
          },
        ],
      },
    };

    const result = selectPrefetchedSectionItems(socialSnapshot, 'social', 10);

    expect(result.sourceSection).toBe('technology');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].section).toBe('social');
    expect(result.items[0].title).toBe('Tech trend');
  });

  it('returns stale items with stale marker so callers can show data rather than nothing', () => {
    const staleSnapshot = {
      ...snapshot,
      fetchedAt: Date.now() - SECTION_SNAPSHOT_MAX_AGE_MS - 1000,
    };

    const result = selectPrefetchedSectionItems(staleSnapshot, 'chennai', 10);

    // Stale snapshot should return available items (not empty) so the UI shows
    // something rather than "No news available". Caller shows a stale warning.
    expect(result.items).toHaveLength(2);
    expect(result.items[0]._prefetchedSection).toBe(true);
    expect(result.stale).toBe(true);
    expect(result.staleReason).toBe('sections_snapshot_stale');
  });

  it('maps local requests to muscat prefetched section', () => {
    const muscatSnapshot = {
      schemaVersion: 2,
      fetchedAt: Date.now(),
      sections: {
        muscat: [
          {
            id: 'om1',
            title: 'Muscat weather update',
            summary: 'Hot and humid conditions expected.',
            url: 'https://example.com/om1',
            source: 'Times of Oman',
            sourceGroup: 'times_of_oman',
            publishedAt: Date.now() - 1000,
          },
        ],
      },
    };

    const result = selectPrefetchedSectionItems(muscatSnapshot, 'local', 10);

    expect(result.sourceSection).toBe('muscat');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].section).toBe('local');
  });

  it('marks sections stale when every item is older than the item freshness gate', () => {
    const oldItemsSnapshot = {
      ...snapshot,
      fetchedAt: Date.now(),
      sections: {
        tn: [
          {
            title: 'Old workflow story',
            url: 'https://example.com/old',
            source: 'Example',
            publishedAt: Date.now() - 40 * 60 * 60 * 1000,
          },
        ],
      },
    };

    const result = selectPrefetchedSectionItems(oldItemsSnapshot, 'chennai', 10);

    expect(result.items).toEqual([]);
    expect(result.stale).toBe(true);
    expect(result.staleReason).toBe('section_items_stale');
  });
});

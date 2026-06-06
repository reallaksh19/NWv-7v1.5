import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSnapshotRawFetcher } from './insightSnapshotFetcher.js';

const H = 60 * 60 * 1000;

function snapshotStory(id, ageHours) {
  return {
    id,
    title: `${id} title`,
    summary: `${id} summary`,
    source: 'Example',
    sourceGroup: 'example',
    url: `https://example.com/${id}`,
    publishedAt: Date.now() - ageHours * H,
  };
}

describe('Insight snapshot live/static slotting certification', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-30T08:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses current story age instead of Python slot metadata', async () => {
    const snapshot = {
      schemaVersion: 2,
      fetchedAt: Date.now(),
      stories: [
        snapshotStory('age-3h', 3),
        snapshotStory('age-5h', 5),
        snapshotStory('age-13h', 13),
        snapshotStory('age-25h', 25),
        snapshotStory('age-50h', 50),
      ],
      slotMeta: {
        now: { storyIds: ['age-50h'] },
        minus4h: { storyIds: ['age-3h'] },
        minus12h: { storyIds: ['age-5h'] },
        minus24h: { storyIds: ['age-13h'] },
      },
    };

    const fetcher = createSnapshotRawFetcher(snapshot);
    const nowStories = await fetcher('now');
    const minus4hStories = await fetcher('minus4h');
    const minus12hStories = await fetcher('minus12h');
    const minus24hStories = await fetcher('minus24h');
    const allSelectedIds = [
      ...nowStories,
      ...minus4hStories,
      ...minus12hStories,
      ...minus24hStories,
    ].map(story => story.id);

    expect(nowStories.find(story => story.id === 'age-3h')?._snapshotIntake.selectedFromSlot).toBe('now');
    expect(minus4hStories.find(story => story.id === 'age-5h')?._snapshotIntake.selectedFromSlot).toBe('minus4h');
    expect(minus12hStories.find(story => story.id === 'age-13h')?._snapshotIntake.selectedFromSlot).toBe('minus12h');
    expect(minus24hStories.find(story => story.id === 'age-25h')?._snapshotIntake.selectedFromSlot).toBe('minus24h');
    expect(allSelectedIds).not.toContain('age-50h');
  });
});

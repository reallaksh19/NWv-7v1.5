import { describe, expect, it } from 'vitest';
import {
  BREAKING_ITEM_MAX_AGE_MS,
  getBreakingSnapshotRuntimeSummary,
  isSupportedBreakingSnapshot,
  normalizeBreakingItem,
  selectFreshBreakingItems,
} from './breakingSnapshotFetcher.js';

const NOW = 1_700_000_000_000;

function snapshotWith(breaking) {
  return { schemaVersion: 1, fetchedAt: NOW, contentHash: 'abc', breaking };
}

describe('breakingSnapshotFetcher schema support', () => {
  it('accepts schemaVersion 1 with a breaking array', () => {
    expect(isSupportedBreakingSnapshot(snapshotWith([]))).toBe(true);
  });

  it('rejects unsupported / malformed snapshots', () => {
    expect(isSupportedBreakingSnapshot({ schemaVersion: 2, breaking: [] })).toBe(false);
    expect(isSupportedBreakingSnapshot({ schemaVersion: 1 })).toBe(false);
    expect(isSupportedBreakingSnapshot(null)).toBe(false);
  });
});

describe('breakingSnapshotFetcher.normalizeBreakingItem', () => {
  it('maps to the renderer/ranking shape and marks breaking', () => {
    const item = normalizeBreakingItem({
      id: 'q1',
      title: 'Earthquake hits coastal city',
      summary: 'Rescue underway',
      url: 'https://example.com/q1',
      source: 'The Hindu',
      publishedAt: NOW - 1000,
      breakingScore: 4.2,
      sourceCount: 3,
    });

    expect(item.isBreaking).toBe(true);
    expect(item.section).toBe('breaking');
    expect(item.headline).toBe('Earthquake hits coastal city');
    expect(item.link).toBe('https://example.com/q1');
    expect(item.breakingScore).toBe(4.2);
    expect(item.sourceCount).toBe(3);
    expect(item._fromBreakingSnapshot).toBe(true);
  });

  it('falls back to firstSeen for publishedAt and synthesizes an id', () => {
    const item = normalizeBreakingItem({ title: 'No url story', firstSeen: NOW - 5000 });
    expect(item.publishedAt).toBe(NOW - 5000);
    expect(item.id).toBeTruthy();
  });
});

describe('breakingSnapshotFetcher.selectFreshBreakingItems', () => {
  it('drops items older than the per-item age gate', () => {
    const fresh = { id: 'fresh', title: 'Fresh strike', publishedAt: NOW - 1000, breakingScore: 2 };
    const stale = {
      id: 'stale',
      title: 'Old strike',
      publishedAt: NOW - (BREAKING_ITEM_MAX_AGE_MS + 60_000),
      breakingScore: 9,
    };

    const result = selectFreshBreakingItems(snapshotWith([stale, fresh]), NOW);
    expect(result.map(i => i.id)).toEqual(['fresh']);
  });

  it('ranks fresh items by breaking score then recency', () => {
    const result = selectFreshBreakingItems(
      snapshotWith([
        { id: 'a', title: 'A', publishedAt: NOW - 1000, breakingScore: 2 },
        { id: 'b', title: 'B', publishedAt: NOW - 2000, breakingScore: 5 },
      ]),
      NOW,
    );
    expect(result.map(i => i.id)).toEqual(['b', 'a']);
  });

  it('returns [] for unsupported snapshots', () => {
    expect(selectFreshBreakingItems({ schemaVersion: 2 }, NOW)).toEqual([]);
    expect(selectFreshBreakingItems(null, NOW)).toEqual([]);
  });
});

describe('breakingSnapshotFetcher.getBreakingSnapshotRuntimeSummary', () => {
  it('summarizes total vs fresh counts', () => {
    const summary = getBreakingSnapshotRuntimeSummary(
      snapshotWith([
        { id: 'a', title: 'A', publishedAt: NOW - 1000, breakingScore: 2 },
        { id: 'b', title: 'B', publishedAt: NOW - (BREAKING_ITEM_MAX_AGE_MS + 1), breakingScore: 2 },
      ]),
      NOW,
    );
    expect(summary.supported).toBe(true);
    expect(summary.totalBreaking).toBe(2);
    expect(summary.freshBreaking).toBe(1);
  });
});

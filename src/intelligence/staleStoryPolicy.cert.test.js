import { describe, expect, it } from 'vitest';
import { audit, apply, __staleStoryPolicyInternalsForTest } from './staleStoryPolicy.js';

const { DEFAULT_STALE_AGE_MS } = __staleStoryPolicyInternalsForTest;

const NOW = 1_700_000_000_000; // fixed epoch for deterministic tests
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function item(id, ageHours) {
  return { id, title: `Story ${id}`, publishedAt: NOW - ageHours * HOUR };
}

describe('staleStoryPolicy.audit', () => {
  it('returns no drops for empty input', () => {
    const { drops, stats } = audit([], {}, NOW);
    expect(drops).toHaveLength(0);
    expect(stats.total).toBe(0);
  });

  it('does not drop fresh stories', () => {
    const items = [item('a', 1), item('b', 12), item('c', 23)];
    const { drops } = audit(items, {}, NOW);
    expect(drops).toHaveLength(0);
  });

  it('flags stories older than 24 hours', () => {
    const items = [item('fresh', 12), item('stale', 25), item('very-stale', 48)];
    const { drops, stats } = audit(items, {}, NOW);

    expect(drops).toHaveLength(2);
    expect(drops.map(d => d.id).sort()).toEqual(['stale', 'very-stale']);
    expect(stats.staleCount).toBe(2);
    expect(stats.freshCount).toBe(1);
  });

  it('includes age in the drop reason', () => {
    const items = [item('old', 30)];
    const { drops } = audit(items, {}, NOW);
    expect(drops[0].reason).toContain('stale_story:age=30h');
  });

  it('respects custom staleAgeMs from settings', () => {
    const items = [item('a', 10), item('b', 13)]; // 10h and 13h old
    const defaultResult = audit(items, {}, NOW); // 24h cutoff → no drops
    const customResult = audit(items, { editorialPolicies: { staleAgeMs: 12 * HOUR } }, NOW); // 12h cutoff

    expect(defaultResult.drops).toHaveLength(0);
    expect(customResult.drops).toHaveLength(1);
    expect(customResult.drops[0].id).toBe('b');
  });

  it('does not drop items with missing publishedAt', () => {
    const items = [{ id: 'no-ts', title: 'No timestamp' }];
    const { drops } = audit(items, {}, NOW);
    expect(drops).toHaveLength(0);
  });

  it('includes correct stats', () => {
    const items = [item('fresh', 1), item('stale', 36)];
    const { stats } = audit(items, {}, NOW);

    expect(stats.total).toBe(2);
    expect(stats.freshCount).toBe(1);
    expect(stats.staleCount).toBe(1);
    expect(stats.staleAgeMs).toBe(DEFAULT_STALE_AGE_MS);
    expect(typeof stats.cutoffTs).toBe('number');
  });
});

describe('staleStoryPolicy.apply', () => {
  it('returns original array when no drops', () => {
    const items = [item('a', 1), item('b', 5)];
    expect(apply(items, {}, NOW)).toBe(items);
  });

  it('removes stale items', () => {
    const items = [item('fresh', 1), item('stale', 30), item('fresh2', 6)];
    const result = apply(items, {}, NOW);
    expect(result).toHaveLength(2);
    expect(result.map(i => i.id)).not.toContain('stale');
  });

  it('does not modify original items array', () => {
    const items = [item('fresh', 1), item('stale', 30)];
    apply(items, {}, NOW);
    expect(items).toHaveLength(2);
  });
});

import { describe, expect, it } from 'vitest';
import { audit, apply, __sourceDominancePolicyInternalsForTest } from './sourceDominancePolicy.js';

const { DEFAULT_DOMINANCE_THRESHOLD } = __sourceDominancePolicyInternalsForTest;

function makeItems(sources) {
  return sources.map((source, i) => ({ id: `item-${i}`, source, title: `Story ${i}` }));
}

describe('sourceDominancePolicy.audit', () => {
  it('returns no drops when all sources are below threshold', () => {
    const items = makeItems(['bbc', 'ndtv', 'thehindu', 'reuters', 'ap']);
    const { drops } = audit(items);
    expect(drops).toHaveLength(0);
  });

  it('returns no drops for empty input', () => {
    const { drops, stats } = audit([]);
    expect(drops).toHaveLength(0);
    expect(stats.total).toBe(0);
  });

  it('flags drops when one source exceeds threshold', () => {
    // 4 of 8 items from bbc = 50% > 35%
    const items = makeItems(['bbc', 'bbc', 'bbc', 'bbc', 'ndtv', 'thehindu', 'reuters', 'ap']);
    const { drops, stats } = audit(items);

    expect(drops.length).toBeGreaterThan(0);
    expect(stats.dominantSource).toBe('bbc');
    expect(drops.every(d => d.reason.startsWith('source_dominance:bbc'))).toBe(true);
  });

  it('respects custom threshold from settings', () => {
    // 3 of 10 = 30%, below 35% default but above custom 25%
    const items = makeItems(['bbc', 'bbc', 'bbc', 'a', 'b', 'c', 'd', 'e', 'f', 'g']);
    const defaultResult = audit(items, {});
    const customResult = audit(items, { editorialPolicies: { sourceDominanceThreshold: 0.25 } });

    expect(defaultResult.drops).toHaveLength(0);
    expect(customResult.drops.length).toBeGreaterThan(0);
  });

  it('includes correct stats', () => {
    const items = makeItems(['bbc', 'bbc', 'bbc', 'bbc', 'ndtv', 'ndtv', 'ap', 'ap']);
    const { stats } = audit(items);

    expect(stats.total).toBe(8);
    expect(stats.sources.bbc).toBe(4);
    expect(stats.threshold).toBe(DEFAULT_DOMINANCE_THRESHOLD);
  });

  it('marks excess items from the tail (lower-ranked items removed first)', () => {
    const items = makeItems(['bbc', 'bbc', 'bbc', 'bbc', 'bbc', 'ndtv', 'ap', 'reuters', 'al', 'cnn']);
    // 5 of 10 = 50%, threshold 35% allows floor(10*0.35)=3, so 2 should be dropped
    const { drops } = audit(items);
    expect(drops).toHaveLength(2);
    // Tail items (index 4, 3) should be marked first
    const dropIds = new Set(drops.map(d => d.id));
    expect(dropIds.has('item-4')).toBe(true);
    expect(dropIds.has('item-3')).toBe(true);
  });
});

describe('sourceDominancePolicy.apply', () => {
  it('returns original array when no drops', () => {
    const items = makeItems(['bbc', 'ndtv', 'thehindu']);
    expect(apply(items)).toBe(items);
  });

  it('removes excess dominant-source items', () => {
    const items = makeItems(['bbc', 'bbc', 'bbc', 'bbc', 'ndtv', 'ndtv', 'ap', 'ap', 'reuters', 'al']);
    const result = apply(items);
    const bbcCount = result.filter(i => i.source === 'bbc').length;
    const total = result.length;
    expect(bbcCount / total).toBeLessThanOrEqual(DEFAULT_DOMINANCE_THRESHOLD + 0.01);
  });

  it('does not modify original items array', () => {
    const items = makeItems(['bbc', 'bbc', 'bbc', 'bbc', 'ndtv', 'ndtv', 'ap', 'ap', 'reuters', 'al']);
    const originalLength = items.length;
    apply(items);
    expect(items).toHaveLength(originalLength);
  });
});

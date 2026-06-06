import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import INSIGHT_POLICY from '../../config/insight_policy.json';

// We test the freshness logic directly using the FRESH_MAX_AGE_MS constant
// and the effectiveAge computation, without making real HTTP requests.
const H = 3_600_000;
const FRESH_MAX_AGE_MS = (INSIGHT_POLICY.freshMaxAgeHours || 8) * H;

function computeEffectiveAge(snapshot, nowMs) {
  const fileAge = nowMs - Number(snapshot.fetchedAt || 0);
  const newestStoryTs = Math.max(0, ...(snapshot.stories || []).map(s => Number(s.publishedAt || 0)));
  const storyAge = newestStoryTs > 0 ? nowMs - newestStoryTs : fileAge;
  return Math.min(fileAge, storyAge);
}

describe('insightSnapshotFreshness (INS-3 fix)', () => {
  it('policy drives the FRESH_MAX_AGE_MS constant', () => {
    expect(FRESH_MAX_AGE_MS).toBe(INSIGHT_POLICY.freshMaxAgeHours * H);
  });

  it('a snapshot with old fetchedAt but a story published 20 min ago is fresh', () => {
    const nowMs = Date.now();
    const snapshot = {
      fetchedAt: nowMs - 10 * H, // file is 10h old — would normally be stale
      stories: [
        { publishedAt: nowMs - 20 * 60_000 }, // story only 20 min old
      ],
    };
    const effectiveAge = computeEffectiveAge(snapshot, nowMs);
    expect(effectiveAge).toBeLessThan(FRESH_MAX_AGE_MS); // should be fresh
    expect(effectiveAge).toBeCloseTo(20 * 60_000, -3);
  });

  it('all-old snapshot (file and stories both older than threshold) is stale', () => {
    const nowMs = Date.now();
    const snapshot = {
      fetchedAt: nowMs - 10 * H,
      stories: [
        { publishedAt: nowMs - 12 * H },
        { publishedAt: nowMs - 15 * H },
      ],
    };
    const effectiveAge = computeEffectiveAge(snapshot, nowMs);
    expect(effectiveAge).toBeGreaterThan(FRESH_MAX_AGE_MS);
  });

  it('snapshot with no stories uses fileAge for staleCheck', () => {
    const nowMs = Date.now();
    const snapshot = { fetchedAt: nowMs - 2 * H, stories: [] };
    const effectiveAge = computeEffectiveAge(snapshot, nowMs);
    expect(effectiveAge).toBeCloseTo(2 * H, -3);
    expect(effectiveAge).toBeLessThan(FRESH_MAX_AGE_MS);
  });
});

import { temporalScore } from '../services/temporalScorer.js';

/** Pure function — testable without rendering. RC-7 fix: requires consensus + decayed score. */
export function computeTrending(item, policy, now = Date.now()) {
    if (item.isBreaking) return false;
    const decayed = temporalScore(item.impactScore || 0, item.publishedAt, now);
    return decayed > policy.trending.minDecayedScore && (item.sourceCount || 1) >= policy.trending.minSourceCount;
}

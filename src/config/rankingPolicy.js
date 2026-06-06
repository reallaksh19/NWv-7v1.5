import RAW from '../../config/ranking_policy.json';

export const DEFAULT_RANKING_POLICY = Object.freeze(RAW);

/** Merge user settings over the policy file. Settings win at the leaf. */
export function getRankingPolicy(settings = {}) {
  const w = settings.rankingWeights || {};
  return {
    ...DEFAULT_RANKING_POLICY,
    freshness: { ...DEFAULT_RANKING_POLICY.freshness, ...(w.freshness || {}) },
    trending: { ...DEFAULT_RANKING_POLICY.trending, ...(w.trending || {}) },
    weights: { ...DEFAULT_RANKING_POLICY.weights },
  };
}

const norm = (s) => ` ${String(s || '').toLowerCase()} `;

export function matchesEntertainmentGuard(text) {
  // Word/phrase-boundary match (NOT bare substring) so broad words like
  // "season" / "trailer" can't flag real news such as "monsoon season floods"
  // or "trailer truck overturns, 3 dead" as entertainment.
  const low = String(text || '').toLowerCase();
  return DEFAULT_RANKING_POLICY.entertainmentGuard.some((g) => hasWord(low, g));
}

export function severityHits(text) {
  const low = norm(text);
  return DEFAULT_RANKING_POLICY.severityLexicon.filter((t) => low.includes(t));
}

export function geoScaleScore(text) {
  const low = norm(text);
  const g = DEFAULT_RANKING_POLICY.geoScale;
  if (g.global.some((k) => low.includes(k))) return 1.5;
  if (g.national.some((k) => low.includes(k))) return 1.3;
  if (g.regional.some((k) => low.includes(k))) return 1.1;
  return 1.0;
}

export function hasWord(text, term) {
  return new RegExp(`\\b${String(term).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text);
}

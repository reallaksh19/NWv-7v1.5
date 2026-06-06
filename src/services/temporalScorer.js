import { DEFAULT_RANKING_POLICY } from '../config/rankingPolicy.js';

/**
 * temporalScorer.js — Exponential time-decay freshness scorer.
 *
 * Replaces hard freshness cut-offs with smooth decay:
 *   weight = e^(-λ × age_hours)   where λ = ln(2) / halfLifeHours
 *
 * Half-lives are driven by ranking_policy.json (default 10h / 36h).
 */

const HALF_LIFE_HOURS = DEFAULT_RANKING_POLICY.freshness.halfLifeHours;
const LONG_FORM_HALF_LIFE_HOURS = DEFAULT_RANKING_POLICY.freshness.longFormHalfLifeHours;

function lambda(halfLifeHours) {
  return Math.LN2 / halfLifeHours;
}

function isLongForm(article) {
  const section = (article.section || '').toLowerCase();
  return section === 'analysis' || section === 'opinion' || section === 'features';
}

/**
 * @param {number} baseScore      Raw impact/relevance score (e.g. 0–10)
 * @param {number} publishedAt    Unix timestamp in milliseconds
 * @param {number} [now]          Override for unit testing
 * @param {number} [halfLifeHours] Decay half-life; defaults to policy value (10h)
 * @returns {number}              Time-decayed score (always >= 0)
 */
export function temporalScore(baseScore, publishedAt, now = Date.now(), halfLifeHours = HALF_LIFE_HOURS) {
  if (!publishedAt || isNaN(publishedAt)) return baseScore * 0.1;
  const ageHours = Math.max(0, now - publishedAt) / 3_600_000;
  return baseScore * Math.exp(-lambda(halfLifeHours) * ageHours);
}

/**
 * Re-rank an array of articles by decayed score.
 * Analysis/opinion/feature sections use the long-form half-life; all others use the standard.
 * Non-destructive.
 * @param {Array<{impactScore?: number, publishedAt: number, section?: string}>} articles
 * @returns {Array} Sorted highest temporal-score first
 */
export function rankByTemporalScore(articles) {
  const now = Date.now();
  return [...articles].sort((a, b) => {
    const hA = isLongForm(a) ? LONG_FORM_HALF_LIFE_HOURS : HALF_LIFE_HOURS;
    const hB = isLongForm(b) ? LONG_FORM_HALF_LIFE_HOURS : HALF_LIFE_HOURS;
    return temporalScore(b.impactScore || 0, b.publishedAt, now, hB) -
           temporalScore(a.impactScore || 0, a.publishedAt, now, hA);
  });
}

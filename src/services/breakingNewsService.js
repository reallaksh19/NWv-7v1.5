/**
 * breakingNewsService.js — shared breaking-news predicate + merge logic.
 *
 * `isBreakingStory` is the single source of truth for "is this breaking?" used
 * across ranking (front-page pin, top-stories pin) so server-flagged snapshot
 * items and client-detected items are treated identically.
 *
 * `mergeBreakingNews` combines the workflow-computed breaking snapshot with any
 * client-detected breaking items. Snapshot items win on conflicts (they reflect
 * the clean multi-source view), duplicates are collapsed, and the result is
 * ranked by breaking score.
 */

// Matches the legacy NewsContext threshold so behavior is consistent.
const BREAKING_SCORE_FLOOR = 1.5;

export function isBreakingStory(item) {
  if (!item) return false;
  return Boolean(item.isBreaking) || Number(item.breakingScore || 0) > BREAKING_SCORE_FLOOR;
}

function dedupeKey(item) {
  const id = String(item?.id || '').trim().toLowerCase();
  if (id) return `id:${id}`;
  const url = String(item?.url || item?.link || '').trim().toLowerCase();
  if (url) return `url:${url}`;
  return `title:${String(item?.title || item?.headline || '').trim().toLowerCase()}`;
}

/**
 * @param {Array} clientBreaking   Items the in-session detector flagged.
 * @param {Array} snapshotBreaking Items from breaking_latest.json (authoritative).
 * @param {number} [limit]         Max items to return.
 */
export function mergeBreakingNews(clientBreaking = [], snapshotBreaking = [], limit = 3) {
  const byKey = new Map();

  // Snapshot first so it wins on key collisions.
  for (const item of [...snapshotBreaking, ...clientBreaking]) {
    if (!item || !isBreakingStory(item)) continue;
    const key = dedupeKey(item);
    if (!byKey.has(key)) byKey.set(key, item);
  }

  return [...byKey.values()]
    .sort((a, b) => (Number(b.breakingScore || 0) - Number(a.breakingScore || 0)) ||
                    (Number(b.publishedAt || 0) - Number(a.publishedAt || 0)))
    .slice(0, Math.max(0, limit));
}

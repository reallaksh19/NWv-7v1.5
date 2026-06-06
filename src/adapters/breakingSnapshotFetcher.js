/**
 * breakingSnapshotFetcher.js — browser ingestion of the workflow-computed
 * breaking-news mini-snapshot (public/newsdata/breaking_latest.json).
 *
 * The workflow (fetch_breaking_news.py) decides "breaking" server-side using a
 * clean multi-source view; the browser trusts those flags instead of trying to
 * recompute breaking from a thin client-side window (which almost never fires on
 * snapshot data). Freshness is gated per-item by publishedAt — not by the
 * snapshot's fetchedAt — so a steady-state file that wasn't rewritten (no new
 * breaking) is still handled correctly.
 */

const BREAKING_SNAPSHOT_PATH = '/newsdata/breaking_latest.json';
const BREAKING_SNAPSHOT_TTL_MS = 3 * 60 * 1000; // in-memory reuse window
// Surface a breaking item only while it is genuinely recent. This is the layer
// that prevents stale "breaking" from lingering once the event has aged out.
export const BREAKING_ITEM_MAX_AGE_MS = 6 * 60 * 60 * 1000;

let memorySnapshot = null;

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function hash(value) {
  const text = String(value || '');
  let h = 0;
  for (let index = 0; index < text.length; index += 1) {
    h = (h << 5) - h + text.charCodeAt(index);
    h |= 0;
  }
  return String(h);
}

export function isSupportedBreakingSnapshot(snapshot) {
  return Number(snapshot?.schemaVersion || 0) === 1 && Array.isArray(snapshot?.breaking);
}

function normalizeTimestamp(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  // Tolerate seconds-based timestamps.
  return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
}

export function normalizeBreakingItem(item) {
  const title = safeText(item?.title || item?.headline, 'Untitled');
  const summary = safeText(item?.summary || item?.description, '');
  const url = safeText(item?.url || item?.link, '');
  const source = safeText(item?.source || item?.sourceGroup, 'Unknown');
  const publishedAt = normalizeTimestamp(item?.publishedAt || item?.firstSeen) || Date.now();

  return {
    ...item,
    id: safeText(item?.id || hash(url || title)),
    title,
    headline: title,
    summary,
    description: summary,
    url,
    link: url,
    source,
    sourceGroup: safeText(item?.sourceGroup || source, source),
    publishedAt,
    time: new Date(publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    section: 'breaking',
    isBreaking: true,
    breakingScore: Number(item?.breakingScore || 0),
    breakingReasons: safeArray(item?.breakingReasons),
    sourceCount: Math.max(1, Number(item?.sourceCount || (safeArray(item?.allSources).length || 1))),
    _fromBreakingSnapshot: true,
  };
}

/**
 * Pure selector: normalize + drop aged-out items + rank by breaking score.
 * @param {object} snapshot  Parsed breaking_latest.json
 * @param {number} [now]     Override for tests
 */
export function selectFreshBreakingItems(snapshot, now = Date.now()) {
  if (!isSupportedBreakingSnapshot(snapshot)) return [];

  return safeArray(snapshot.breaking)
    .map(normalizeBreakingItem)
    .filter(item => now - item.publishedAt <= BREAKING_ITEM_MAX_AGE_MS)
    .sort((a, b) => (b.breakingScore - a.breakingScore) || (b.publishedAt - a.publishedAt));
}

export function getBreakingSnapshotRuntimeSummary(snapshot, now = Date.now()) {
  return {
    schemaVersion: Number(snapshot?.schemaVersion || 0),
    supported: isSupportedBreakingSnapshot(snapshot),
    fetchedAt: Number(snapshot?.fetchedAt || 0),
    ageMs: Math.max(0, now - Number(snapshot?.fetchedAt || 0)),
    contentHash: snapshot?.contentHash || '',
    totalBreaking: safeArray(snapshot?.breaking).length,
    freshBreaking: selectFreshBreakingItems(snapshot, now).length,
  };
}

function getSnapshotUrl() {
  const base = import.meta?.env?.BASE_URL || '/';
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${cleanBase}${BREAKING_SNAPSHOT_PATH}?t=${Date.now()}`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Network loader with small retry/backoff. Returns the parsed snapshot, or
 * `null` when the file is missing/unsupported (callers degrade gracefully —
 * an absent breaking file is a valid "nothing breaking" state, not an error).
 */
export async function loadBreakingSnapshot({ force = false } = {}) {
  if (!force && memorySnapshot && Date.now() - memorySnapshot.loadedAt < BREAKING_SNAPSHOT_TTL_MS) {
    return memorySnapshot.snapshot;
  }

  let response;
  const backoffs = [1000, 2000];
  for (let attempt = 0; attempt < backoffs.length + 1; attempt += 1) {
    try {
      response = await fetch(getSnapshotUrl(), {
        cache: 'no-store',
        headers: { 'cache-control': 'no-cache', pragma: 'no-cache' },
      });
      if (!response.ok) throw new Error(`breaking snapshot fetch failed: HTTP ${response.status}`);
      break;
    } catch (error) {
      if (attempt >= backoffs.length) {
        console.warn('[breakingSnapshotFetcher] load failed', { message: error?.message || String(error) });
        return null;
      }
      await sleep(backoffs[attempt]);
    }
  }

  try {
    const snapshot = await response.json();
    if (!isSupportedBreakingSnapshot(snapshot)) return null;
    memorySnapshot = { loadedAt: Date.now(), snapshot };
    return snapshot;
  } catch (error) {
    console.warn('[breakingSnapshotFetcher] parse failed', { message: error?.message || String(error) });
    return null;
  }
}

/** Convenience: load + select fresh items in one call. */
export async function loadFreshBreakingItems({ force = false, now = Date.now() } = {}) {
  const snapshot = await loadBreakingSnapshot({ force });
  return snapshot ? selectFreshBreakingItems(snapshot, now) : [];
}

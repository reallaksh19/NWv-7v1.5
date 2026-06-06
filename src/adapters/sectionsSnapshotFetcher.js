const SECTION_SNAPSHOT_PATH = '/newsdata/sections_latest.json';
const SECTION_SNAPSHOT_TTL_MS = 10 * 60 * 1000;
export const SECTION_SNAPSHOT_MAX_AGE_MS = 12 * 60 * 60 * 1000;
export const SECTION_ITEM_MAX_AGE_MS = 36 * 60 * 60 * 1000;

const SECTION_ALIASES = {
  chennai: 'tn',
  tamilnadu: 'tn',
  tamilNadu: 'tn',
  social: 'technology',
  buzz: 'technology',
  top: 'topStories',
  topstories: 'topStories',
  local: 'muscat',
  oman: 'muscat',
};

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

function normalizeSectionKey(section) {
  const key = String(section || '').trim();
  return SECTION_ALIASES[key] || SECTION_ALIASES[key.toLowerCase()] || key;
}

function isSupportedSectionsSnapshot(snapshot) {
  const schema = Number(snapshot?.schemaVersion || 0);
  return schema === 1 || schema === 2;
}

function sectionSnapshotAgeMs(snapshot) {
  return Math.max(0, Date.now() - Number(snapshot?.fetchedAt || 0));
}

function isSectionsSnapshotFresh(snapshot, maxAgeMs = SECTION_SNAPSHOT_MAX_AGE_MS) {
  if (!isSupportedSectionsSnapshot(snapshot)) return false;
  const fetchedAt = Number(snapshot?.fetchedAt || 0);
  if (!Number.isFinite(fetchedAt) || fetchedAt <= 0) return false;
  return Date.now() - fetchedAt <= maxAgeMs;
}

function isFreshSectionItem(item, maxAgeMs = SECTION_ITEM_MAX_AGE_MS) {
  const publishedAt = Number(item?.publishedAt || item?.pubDate || item?.date || 0);
  if (!Number.isFinite(publishedAt) || publishedAt <= 0) return true;
  const normalized = publishedAt < 10_000_000_000 ? publishedAt * 1000 : publishedAt;
  return Date.now() - normalized <= maxAgeMs;
}

function getSnapshotUrl() {
  const base = import.meta?.env?.BASE_URL || '/';
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${cleanBase}${SECTION_SNAPSHOT_PATH}?t=${Date.now()}`;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizePrefetchedSectionItem(item, requestedSection, sourceSection) {
  const title = safeText(item.title || item.headline, 'Untitled');
  const description = safeText(item.description || item.summary, '');
  const url = safeText(item.url || item.link || item.guid, '');
  const source = safeText(item.source || item.sourceGroup, 'Unknown');
  const publishedAt = Number(item.publishedAt || item.pubDate || item.date || Date.now());

  return {
    ...item,
    id: safeText(item.id || hash(url || title)),
    title,
    headline: title,
    description,
    summary: description,
    link: url,
    url,
    source,
    sourceGroup: safeText(item.sourceGroup || source, source),
    publishedAt,
    fetchedAt: Number(item.fetchedAt || Date.now()),
    time: new Date(publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    section: requestedSection,
    sourceSection,
    impactScore: Number(item.impactScore || 0),
    imageUrl: item.imageUrl || item.image || null,
    _prefetchedSection: true,
  };
}

export function getSectionsSnapshotRuntimeSummary(snapshot) {
  const sections = snapshot?.sections && typeof snapshot.sections === 'object'
    ? snapshot.sections
    : {};

  return {
    schemaVersion: Number(snapshot?.schemaVersion || 0),
    supported: isSupportedSectionsSnapshot(snapshot),
    fetchedAt: Number(snapshot?.fetchedAt || 0),
    ageMs: sectionSnapshotAgeMs(snapshot),
    stale: !isSectionsSnapshotFresh(snapshot),
    contentHash: snapshot?.contentHash || '',
    sectionCount: Object.keys(sections).length,
    totalStories: Object.values(sections).reduce((sum, items) => sum + safeArray(items).length, 0),
    hasSectionQuality: Boolean(snapshot?.sectionQuality),
    sectionQuality: snapshot?.sectionQuality || null,
  };
}

export async function loadSectionsSnapshot({ force = false } = {}) {
  if (!force && memorySnapshot && Date.now() - memorySnapshot.loadedAt < SECTION_SNAPSHOT_TTL_MS) {
    return memorySnapshot.snapshot;
  }

  let response;
  let lastError;
  const backoffs = [2000, 4000, 8000];
  for (let attempt = 0; attempt < backoffs.length; attempt += 1) {
    try {
      response = await fetch(getSnapshotUrl(), {
        cache: 'no-store',
        headers: {
          'cache-control': 'no-cache',
          pragma: 'no-cache',
        },
      });
      if (!response.ok) throw new Error(`sections snapshot fetch failed: HTTP ${response.status}`);
      break;
    } catch (error) {
      lastError = error;
      if (attempt < backoffs.length - 1) await sleep(backoffs[attempt]);
    }
  }

  if (!response || !response.ok) throw lastError || new Error('sections snapshot fetch failed');

  const snapshot = await response.json();

  if (!isSupportedSectionsSnapshot(snapshot)) {
    throw new Error(`unsupported sections snapshot schema: ${snapshot?.schemaVersion}`);
  }

  memorySnapshot = {
    loadedAt: Date.now(),
    snapshot,
  };

  return snapshot;
}

export function selectPrefetchedSectionItems(snapshot, section, limit = 10) {
  if (!isSupportedSectionsSnapshot(snapshot)) {
    return {
      items: [],
      sourceSection: normalizeSectionKey(section),
      quality: null,
      summary: getSectionsSnapshotRuntimeSummary(snapshot),
      stale: true,
      staleReason: 'unsupported_snapshot_schema',
    };
  }

  const requestedSection = String(section || '');
  const sourceSection = normalizeSectionKey(section);
  const sectionItems = safeArray(snapshot?.sections?.[sourceSection]);
  const snapshotStale = !isSectionsSnapshotFresh(snapshot);
  // Always filter per-item freshness; snapshot-level staleness is tracked separately
  // so callers can decide to show stale data with a warning rather than nothing.
  const freshSectionItems = sectionItems.filter(item => isFreshSectionItem(item));
  const staleReason = snapshotStale
    ? 'sections_snapshot_stale'
    : sectionItems.length > 0 && freshSectionItems.length === 0
      ? 'section_items_stale'
      : null;

  // When snapshot is stale, use ALL available items (not just fresh ones) so users
  // see something rather than an empty section — caller marks them as stale.
  const candidateItems = snapshotStale ? sectionItems : freshSectionItems;

  const items = candidateItems
    .map(item => normalizePrefetchedSectionItem(item, requestedSection, sourceSection))
    .sort((a, b) => Number(b.publishedAt || 0) - Number(a.publishedAt || 0))
    .slice(0, Math.max(0, Number(limit || 0)));

  return {
    items,
    sourceSection,
    quality: snapshot?.sectionQuality?.[sourceSection] || null,
    summary: getSectionsSnapshotRuntimeSummary(snapshot),
    stale: Boolean(staleReason),
    staleReason,
  };
}

export async function fetchPrefetchedSectionNews(section, limit = 10) {
  const snapshot = await loadSectionsSnapshot();
  return selectPrefetchedSectionItems(snapshot, section, limit);
}

export function clearSectionsSnapshotCache() {
  memorySnapshot = null;
}

export const __sectionsSnapshotInternalsForTest = {
  isSectionsSnapshotFresh,
  isFreshSectionItem,
};

export default fetchPrefetchedSectionNews;

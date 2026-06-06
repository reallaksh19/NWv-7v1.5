import { runInsightPipeline, applyIncrementalUpdate, DEFAULT_CONFIG, normalizeStory } from '../insight/src/index.ts';
import { fetchStoriesForSlot as fetchRawStoriesForSlot } from './newsFetcher.js';
import { getEmbeddings } from './embeddingsAdapter.js';
import { extractEntities, extractVerbs, extractNumbers, extractKeywords } from './nlpAdapter.js';
import { loadInsightSnapshot, createSnapshotRawFetcher } from './insightSnapshotFetcher.js';
import { getInsightSnapshotSignals } from './insightSnapshotSignalAdapter.js';
import { getRuntimeCapabilities } from '../runtime/runtimeCapabilities.js';

async function normalizeRawStories(rawStories, slot, cfg = DEFAULT_CONFIG, referenceTime = undefined) {
  if (!Array.isArray(rawStories) || rawStories.length === 0) return [];

  const validRawStories = rawStories
    .map((story) => ({
      ...story,
      publishedAt: Number(story?.publishedAt || 0),
      sourceGroup: story?.sourceGroup || story?.source || 'unknown',
      summary: story?.summary || story?.description || '',
      url: story?.url || story?.link || '',
    }))
    .filter((story) => story.title && story.url && Number.isFinite(story.publishedAt) && story.publishedAt > 0);

  if (validRawStories.length === 0) return [];

  const texts = validRawStories.map((story) => `${story.title || ''} ${story.summary || ''}`.trim());

  // Defensive: a failed embedding batch must not blank the whole slot. Fall back to
  // an empty embedding array; normalizeStory tolerates a missing/short vector.
  let embeddings = [];
  try {
    embeddings = await getEmbeddings(texts);
  } catch (error) {
    console.warn('[InsightFetcher] getEmbeddings failed; continuing without embeddings:', error?.message || error);
    embeddings = [];
  }

  const enriched = await Promise.all(validRawStories.map(async (raw, index) => {
    // Defensive: one bad story (NLP throw, malformed fields) must not reject the
    // whole Promise.all batch — return null and let the filter below drop it.
    try {
      const text = texts[index];
      const collectorSignals = getInsightSnapshotSignals(raw);
      const [entities, keywords, verbs, numbers] = collectorSignals.hasCollectorSignals
        ? [
            collectorSignals.entities,
            collectorSignals.keywords,
            collectorSignals.verbs,
            collectorSignals.numbers,
          ]
        : await Promise.all([
            extractEntities(text),
            extractKeywords(text),
            extractVerbs(text),
            extractNumbers(text),
          ]);

      return normalizeStory(
        {
          ...raw,
          angleHints: collectorSignals.angleHints,
          storySignals: {
            ...(raw.storySignals || {}),
            topicTokens: collectorSignals.topicTokens,
            numbers,
            angleHints: collectorSignals.angleHints,
          },
        },
        slot,
        cfg,
        embeddings[index] || [],
        entities,
        keywords,
        verbs,
        numbers,
        referenceTime,
      );
    } catch (error) {
      console.warn(`[InsightFetcher] Skipping story during normalization (${raw?.id || raw?.url || 'unknown'}):`, error?.message || error);
      return null;
    }
  }));

  return enriched.filter(Boolean);
}

export async function slotFetcher(slot) {
  const rawStories = await fetchRawStoriesForSlot(slot);
  return normalizeRawStories(rawStories, slot, DEFAULT_CONFIG);
}

function createNormalizedSnapshotFetcher(snapshot, cfg = DEFAULT_CONFIG) {
  const rawFetcher = createSnapshotRawFetcher(snapshot);
  return async (slot) => normalizeRawStories(await rawFetcher(slot), slot, cfg, snapshot.fetchedAt);
}

export { runInsightPipeline, applyIncrementalUpdate, DEFAULT_CONFIG };

// Reject a "stale" snapshot older than this — beyond the 36h story-retention window a
// snapshot has no usable stories, so serving it as a "front page" is misleading.
const MAX_STALE_SNAPSHOT_AGE_MS = 48 * 60 * 60 * 1000;
// Minimum live stories per slot before we blend in snapshot stories (live can be sparse
// at night or when proxies fail; we never want a blank front page).
const MIN_LIVE_PER_SLOT = 5;

// Stale snapshots keep a real multi-angle floor (2 sources / 2 children) so "different
// angles from different sources" survives degraded data instead of silently collapsing
// to single-angle clusters.
const STALE_PIPELINE_OVERRIDES = {
  WEAK_TREE_CHILD_MIN: 2,
  MIN_SOURCES_PER_TREE: 2,
  TIER_D_EXCLUDE: false,
};

function dedupeStoriesById(stories) {
  const seen = new Set();
  const out = [];
  for (const story of stories || []) {
    const key = String(story?.id || story?.url || story?.title || '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(story);
  }
  return out;
}

/**
 * withSnapshotFallback — composite per-slot fetcher that runs `primary` first and, when
 * it returns fewer than `minPerSlot` usable stories, blends in `fallback`'s stories for
 * that slot (deduped). Guarantees the front page never goes blank when one source is thin.
 */
function withSnapshotFallback(primary, fallback, minPerSlot = MIN_LIVE_PER_SLOT) {
  if (typeof fallback !== 'function') return primary;
  return async (slot) => {
    let primaryStories = [];
    try {
      primaryStories = await primary(slot);
    } catch (error) {
      console.warn(`[InsightFetcher] primary fetch failed for slot ${slot}; using fallback:`, error?.message || error);
      primaryStories = [];
    }
    if (Array.isArray(primaryStories) && primaryStories.length >= minPerSlot) {
      return primaryStories;
    }
    let fallbackStories = [];
    try {
      fallbackStories = await fallback(slot);
    } catch (error) {
      console.warn(`[InsightFetcher] fallback fetch failed for slot ${slot}:`, error?.message || error);
      fallbackStories = [];
    }
    return dedupeStoriesById([...(primaryStories || []), ...(fallbackStories || [])]);
  };
}

/**
 * createInsightFetcher — returns the appropriate SlotFetcher depending on runtime.
 *
 * Host-based decision (unchanged): preferSnapshots → snapshot-first; else live-first.
 * Hardened so neither mode dead-ends to a blank page.
 *
 * On github.io (preferSnapshots = true):
 *   1. Fresh snapshot  (file age ≤ 8 h)
 *   2. Stale snapshot  (age ≤ 48 h, with a 2-angle/2-source floor + reduced-quality label)
 *   3. Best-effort live (only when NO snapshot exists — last resort via proxies)
 *   4. Empty state
 *
 * On full-runtime (local / self-hosted):
 *   Live slotFetcher, blended with a best-effort snapshot fallback so sparse/failed
 *   live feeds never produce a blank front page.
 *
 * @returns {Promise<{ fetcher: Function, source: string, snapshotTs: number, contentHash: string }>}
 */
export async function createInsightFetcher() {
  const { preferSnapshots } = getRuntimeCapabilities();

  if (preferSnapshots) {
    const fresh = await loadInsightSnapshot({ allowStale: false });
    if (fresh) {
      return {
        fetcher:     createNormalizedSnapshotFetcher(fresh, DEFAULT_CONFIG),
        source:      'snapshot',
        snapshotTs:  fresh.fetchedAt,
        contentHash: fresh.contentHash,
        snapshotRuntimeSummary: fresh.runtimeSummary,
      };
    }

    const stale = await loadInsightSnapshot({ allowStale: true });
    const staleAgeMs = stale ? Date.now() - Number(stale.fetchedAt || 0) : Infinity;
    if (stale && staleAgeMs <= MAX_STALE_SNAPSHOT_AGE_MS) {
      console.warn('[InsightFetcher] Using stale snapshot — fresh snapshot unavailable');
      const staleConfig = { ...DEFAULT_CONFIG, ...STALE_PIPELINE_OVERRIDES };
      return {
        fetcher:     createNormalizedSnapshotFetcher(stale, staleConfig),
        source:      'stale-snapshot',
        snapshotTs:  stale.fetchedAt,
        contentHash: stale.contentHash,
        snapshotRuntimeSummary: stale.runtimeSummary,
        pipelineConfigOverrides: { ...STALE_PIPELINE_OVERRIDES },
      };
    }

    if (stale) {
      console.warn(`[InsightFetcher] Stale snapshot too old (${Math.round(staleAgeMs / 3_600_000)}h) — not serving it`);
    }

    // No usable snapshot — best-effort live as a last resort (proxies may work even on
    // static hosts). Guarded to this branch only, so it never floods on the happy path.
    return {
      fetcher:     slotFetcher,
      source:      'live',
      snapshotTs:  Date.now(),
      contentHash: '',
    };
  }

  // Full-runtime: live slotFetcher, blended with a best-effort snapshot fallback.
  let snapshotFetcher = null;
  try {
    const snapshot = await loadInsightSnapshot({ allowStale: true });
    const snapAgeMs = snapshot ? Date.now() - Number(snapshot.fetchedAt || 0) : Infinity;
    if (snapshot && snapAgeMs <= MAX_STALE_SNAPSHOT_AGE_MS) {
      snapshotFetcher = createNormalizedSnapshotFetcher(snapshot, DEFAULT_CONFIG);
    }
  } catch (error) {
    console.warn('[InsightFetcher] snapshot fallback unavailable for live mode:', error?.message || error);
  }

  return {
    fetcher:     withSnapshotFallback(slotFetcher, snapshotFetcher, MIN_LIVE_PER_SLOT),
    source:      'live',
    snapshotTs:  Date.now(),
    contentHash: '',
  };
}

import { buildInsightBenchmarkArticles } from '../benchmarks/insightBenchmark.js';

// ── Benchmark slot fetcher (dev mode only) ────────────────────────────────
export const benchmarkSlotFetcher = async (slot) => {
  const all = buildInsightBenchmarkArticles();
  const NOW = Date.now();
  const H   = 3_600_000;
  return all.filter(a => {
    const age = NOW - a.publishedAt;
    switch (slot) {
      case 'now'      : return age < 4 * H;
      case 'minus4h'  : return age >= 4 * H  && age < 12 * H;
      case 'minus12h' : return age >= 12 * H && age < 24 * H;
      case 'minus24h' : return age >= 24 * H && age < 36 * H;
      default         : return true;
    }
  });
};

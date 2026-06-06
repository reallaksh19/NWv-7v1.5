// ─────────────────────────────────────────────
//  INSIGHT TAB — Main Pipeline Orchestrator
// ─────────────────────────────────────────────

import {
  InsightStory, InsightParent, InsightConfig,
  DEFAULT_CONFIG, PREWARM_SLOTS, SnapshotSlot,
} from "../types";
import {
  getCachedSlot, setCachedSlot, mergeSlotStories,
  slotsNeedingFetch, needsPrewarm, cacheStatus,
} from "../cache/cacheManager";
import {
  applyClusterOverrides,
  applyPostClusterDeltaDedup,
  eventSimilarity,
  removeHardDuplicates,
} from "../dedup/dedup";
import { clusterIntoParentEvents, createCanonicalParent } from "../cluster/cluster";
import { scoreAndRankParents } from "../ranking/ranking";
import { buildChildTree, isWeakTree, tryReplaceWeakestChild } from "../tree/treeBuilder";
import { enforceSourceDiverseChildSelection } from "../tree/sourceDiverseChildSelection";
import { applyTierCFallback } from "../pipeline/normalize";
import { extractInformationDelta } from "./deltaAtoms";
import {
  computeEventAnchor,
  computeTemporalTier,
  enrichClusterEvolution,
  inferEvolutionRole,
} from "./temporalTier";

const MIN_BALANCED_PARENT_COUNT = 3;
const MIN_BALANCED_AVG_ANGLE_COUNT = 1.4;
const MIN_BALANCED_AVG_TEMPORAL_TIER_COUNT = 1.8;
const MIN_BALANCED_AVG_EVOLUTION_ROLE_COUNT = 1.6;

// ── Types for external interfaces ─────────────────────────────────────────────

export interface InsightRunResult {
  parents:       InsightParent[];
  storiesById:   Map<string, InsightStory>;
  hiddenIds:     Set<string>;
  slotsRefetched: SnapshotSlot[];
  cacheStatus:   ReturnType<typeof cacheStatus>;
  ranAt:         number;
}

/** Provided by the host app: fetches raw stories for one snapshot slot */
export type SlotFetcher = (slot: SnapshotSlot) => Promise<InsightStory[]>;

/** Optional: previous cluster sizes for momentum computation */
export type PreviousClusterSizes = Map<string, number>;

// ── Main pipeline ─────────────────────────────────────────────────────────────

export async function runInsightPipeline(
  fetcher: SlotFetcher,
  cfg: InsightConfig = DEFAULT_CONFIG,
  previousClusterSizes: PreviousClusterSizes = new Map(),
  backgroundPrewarmCallback?: (slot: SnapshotSlot) => void
): Promise<InsightRunResult> {

  // ── Step 1: Resolve which slots need a fresh fetch ─────────────────────────
  const slotsToFetch = slotsNeedingFetch(cfg);
  const freshBySlot: Partial<Record<SnapshotSlot, InsightStory[]>> = {};

  await Promise.all(
    slotsToFetch.map(async slot => {
      try {
        freshBySlot[slot] = await fetcher(slot);
      } catch {
        freshBySlot[slot] = []; // degrade gracefully
      }
    })
  );

  // ── Step 2: Merge cached + fresh stories ───────────────────────────────────
  const allStories = mergeSlotStories(freshBySlot, cfg);

  // ── Step 3: Trigger background pre-warm if any slot is approaching TTL ─────
  if (backgroundPrewarmCallback) {
    for (const slot of PREWARM_SLOTS) {
      if (needsPrewarm(slot, cfg)) backgroundPrewarmCallback(slot);
    }
  }

  // ── Step 4: Hard duplicate removal ─────────────────────────────────────────
  const hiddenIds = new Set<string>();
  const deduped   = removeHardDuplicates(allStories, cfg, hiddenIds);

  // ── Step 5: Event clustering ────────────────────────────────────────────────
  const clusters = clusterIntoParentEvents(deduped, cfg);

  // ── Step 6: Create canonical parents ───────────────────────────────────────
  const parents = clusters.map(c => createCanonicalParent(c, cfg));

  // Tag stories with their parentId on the deduped list
  const storiesById = new Map<string, InsightStory>();
  for (const cluster of clusters) {
    for (const s of cluster.stories) storiesById.set(s.id, s);
  }

  // ── Step 7: Apply Tier C fallback ───────────────────────────────────────────
  const tierFiltered = applyTierCFallback(deduped, cfg);
  for (const s of tierFiltered) storiesById.set(s.id, s); // refresh map

  for (const parent of parents) {
    enrichParentClusterForCE(parent, storiesById, cfg);
  }

  // ── Step 8: Score and rank parents ─────────────────────────────────────────
  const ranked = scoreAndRankParents(parents, storiesById, cfg, previousClusterSizes);

  // ── Step 9: Select top N parents, handle weak tree demotion ────────────────
  const topParents = selectTopParentsWithWeakTreeCheck(ranked, storiesById, cfg, hiddenIds);

  // FIX M-5: do NOT pass topParents to setCachedSlot for "now" —
  // getCachedSlot("now") always returns null so the parents were never read back.
  // "now" stories are cached purely so mergeSlotStories can tag them correctly
  // on the next incremental call.
  setCachedSlot("now", freshBySlot["now"] ?? [], cfg);

  return {
    parents:        topParents,
    storiesById,
    hiddenIds,
    slotsRefetched: slotsToFetch,
    cacheStatus:    cacheStatus(cfg),
    ranAt:          Date.now(),
  };
}

function safeArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function getParentChildStories(
  parent: InsightParent,
  storiesById: Map<string, InsightStory>
): InsightStory[] {
  return safeArray(parent.childStoryIds)
    .map(id => storiesById.get(id))
    .filter(Boolean) as InsightStory[];
}

function getVisibleAngleCount(
  parent: InsightParent,
  storiesById: Map<string, InsightStory>
): number {
  const angles = new Set(
    getParentChildStories(parent, storiesById)
      .map(story => story.angle || "unknown")
      .filter(angle => angle !== "unknown")
  );

  return angles.size;
}

function getChildSourceGroupCount(
  parent: InsightParent,
  storiesById: Map<string, InsightStory>
): number {
  const sourceGroups = new Set(
    getParentChildStories(parent, storiesById)
      .map(story => story.sourceGroup || story.source || "unknown")
  );

  return sourceGroups.size;
}

function getChildTemporalTierCount(
  parent: InsightParent,
  storiesById: Map<string, InsightStory>
): number {
  const temporalTiers = new Set(
    getParentChildStories(parent, storiesById)
      .map(story => story.temporalTier)
      .filter(Boolean)
  );

  return temporalTiers.size;
}

function getChildEvolutionRoleCount(
  parent: InsightParent,
  storiesById: Map<string, InsightStory>
): number {
  const evolutionRoles = new Set(
    getParentChildStories(parent, storiesById)
      .map(story => story.evolutionRole)
      .filter(Boolean)
  );

  return evolutionRoles.size;
}

function getClusterSnapshotCount(
  parent: InsightParent,
  storiesById: Map<string, InsightStory>
): number {
  const snapshots = new Set(
    safeArray(parent.clusterStoryIds)
      .map(id => storiesById.get(id))
      .filter(Boolean)
      .map(story => story?.capturedAtSnapshot)
      .filter(Boolean)
  );

  return snapshots.size;
}

function getAngleRecoveryCount(parent: InsightParent): number {
  const diagnostics = (parent.debug as any)?.childSelectionDiagnostics;
  return Number(diagnostics?.angleRecovery?.recoveredCount || 0);
}

function enrichParentClusterForCE(
  parent: InsightParent,
  storiesById: Map<string, InsightStory>,
  cfg: InsightConfig
): InsightStory[] {
  const clusterStories = parent.clusterStoryIds
    .map(id => storiesById.get(id))
    .filter(Boolean) as InsightStory[];
  const sortedByTime = enrichClusterEvolution(parent, clusterStories, cfg);

  for (const story of sortedByTime) {
    const baseline = sortedByTime
      .filter(candidate => candidate.publishedAt < story.publishedAt)
      .slice(-cfg.MAX_BASELINE_STORIES_FOR_DELTA);
    const delta = extractInformationDelta(story, baseline);
    story.informationDelta = delta;
    story.informationDeltaScore = delta.deltaScore;
    story.repeatedFactPenalty = delta.repeatedFactPenalty;
    storiesById.set(story.id, story);
  }

  return sortedByTime;
}

function getParentClusterStories(
  parent: InsightParent,
  storiesById: Map<string, InsightStory>
): InsightStory[] {
  return parent.clusterStoryIds
    .map(id => storiesById.get(id))
    .filter(Boolean) as InsightStory[];
}

function hasCompleteCEFields(stories: InsightStory[]): boolean {
  return stories.every(story =>
    story.temporalTier !== undefined &&
    story.evolutionRole !== undefined &&
    story.informationDeltaScore !== undefined
  );
}

export function computePostTreeQualityScore(
  parent: InsightParent,
  storiesById: Map<string, InsightStory>,
  cfg: InsightConfig
): number {
  const childCount = safeArray(parent.childStoryIds).length;
  const visibleAngleCount = getVisibleAngleCount(parent, storiesById);
  const childSourceGroupCount = getChildSourceGroupCount(parent, storiesById);
  const snapshotCount = getClusterSnapshotCount(parent, storiesById);
  const recoveryCount = getAngleRecoveryCount(parent);

  const baseScore = clamp01(Number(parent.finalParentScore || 0));
  const angleBonus = Math.min(0.30, visibleAngleCount * 0.09);
  const strongAngleBonus = visibleAngleCount >= 3 ? 0.10 : 0;
  const childDepthBonus = Math.min(0.12, (childCount / Math.max(1, cfg.WEAK_TREE_CHILD_MIN)) * 0.10);
  const sourceDiversityBonus = Math.min(0.10, (childSourceGroupCount / Math.max(1, cfg.MIN_SOURCES_PER_TREE)) * 0.08);
  const snapshotBonus = Math.min(0.08, snapshotCount * 0.02);
  const recoveryBonus = Math.min(0.06, recoveryCount * 0.02);

  const singleAnglePenalty = visibleAngleCount < 2 ? 0.22 : 0;
  const weakTreePenalty = parent.weakTree ? 0.18 : 0;
  const thinChildPenalty = childCount < cfg.WEAK_TREE_CHILD_MIN ? 0.10 : 0;

  const postTreeQualityScore =
    baseScore +
    angleBonus +
    strongAngleBonus +
    childDepthBonus +
    sourceDiversityBonus +
    snapshotBonus +
    recoveryBonus -
    singleAnglePenalty -
    weakTreePenalty -
    thinChildPenalty;

  const roundedScore = Math.round(postTreeQualityScore * 10000) / 10000;

  (parent.debug as any).postTreeQualityDiagnostics = {
    formulaVersion: "post-tree-quality-v1-angle-first-selection",
    baseScore,
    childCount,
    visibleAngleCount,
    childSourceGroupCount,
    snapshotCount,
    recoveryCount,
    angleBonus,
    strongAngleBonus,
    childDepthBonus,
    sourceDiversityBonus,
    snapshotBonus,
    recoveryBonus,
    singleAnglePenalty,
    weakTreePenalty,
    thinChildPenalty,
    postTreeQualityScore: roundedScore,
  };

  return roundedScore;
}

function getPostTreeCoverageScore(
  parent: InsightParent,
  storiesById: Map<string, InsightStory>,
  cfg: InsightConfig
): number {
  const metrics = getPostTreeCoverageMetrics(parent, storiesById);
  const minChildCount = Math.min(2, cfg.MAX_CHILDREN_PER_PARENT);

  return (metrics.childCount >= minChildCount ? 4 : 0) +
    (metrics.angleCount >= 2 ? 4 : 0) +
    (metrics.temporalTierCount >= 2 ? 2 : 0) +
    (metrics.evolutionRoleCount >= 2 ? 2 : 0);
}

function getPostTreeCoverageMetrics(
  parent: InsightParent,
  storiesById: Map<string, InsightStory>
): {
  childCount: number;
  angleCount: number;
  temporalTierCount: number;
  evolutionRoleCount: number;
} {
  return {
    childCount: safeArray(parent.childStoryIds).length,
    angleCount: getVisibleAngleCount(parent, storiesById),
    temporalTierCount: getChildTemporalTierCount(parent, storiesById),
    evolutionRoleCount: getChildEvolutionRoleCount(parent, storiesById),
  };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function passesBalancedCoverageFrontier(
  parents: InsightParent[],
  storiesById: Map<string, InsightStory>
): boolean {
  if (parents.length < MIN_BALANCED_PARENT_COUNT) return false;

  const metrics = parents.map(parent => getPostTreeCoverageMetrics(parent, storiesById));

  return average(metrics.map(item => item.angleCount)) >= MIN_BALANCED_AVG_ANGLE_COUNT &&
    average(metrics.map(item => item.temporalTierCount)) >= MIN_BALANCED_AVG_TEMPORAL_TIER_COUNT &&
    average(metrics.map(item => item.evolutionRoleCount)) >= MIN_BALANCED_AVG_EVOLUTION_ROLE_COUNT;
}

function selectBalancedCoverageFrontier(
  orderedParents: InsightParent[],
  storiesById: Map<string, InsightStory>,
  cfg: InsightConfig
): InsightParent[] | null {
  // Sort by coverage score first so highest-coverage parents are picked first,
  // but always return exactly TOP_PARENTS to avoid reducing the visible parent count.
  const candidates = [...orderedParents].sort((a, b) => {
    const aCoverage = getPostTreeCoverageScore(a, storiesById, cfg);
    const bCoverage = getPostTreeCoverageScore(b, storiesById, cfg);
    if (bCoverage !== aCoverage) return bCoverage - aCoverage;
    return comparePostTreeParentQuality(a, b, storiesById, cfg);
  });

  // Take up to TOP_PARENTS; check once after filling.
  const selected = candidates.slice(0, cfg.TOP_PARENTS);
  return passesBalancedCoverageFrontier(selected, storiesById) ? selected : null;
}

export function comparePostTreeParentQuality(
  a: InsightParent,
  b: InsightParent,
  storiesById: Map<string, InsightStory>,
  cfg: InsightConfig
): number {
  const aChildCount = safeArray(a.childStoryIds).length;
  const bChildCount = safeArray(b.childStoryIds).length;
  const aOneChildWeak = Boolean(a.weakTree && aChildCount < 2);
  const bOneChildWeak = Boolean(b.weakTree && bChildCount < 2);

  if (aOneChildWeak !== bOneChildWeak) return aOneChildWeak ? 1 : -1;

  const aQuality = Number((a.debug as any)?.postTreeQualityDiagnostics?.postTreeQualityScore || 0);
  const bQuality = Number((b.debug as any)?.postTreeQualityDiagnostics?.postTreeQualityScore || 0);

  if (bQuality !== aQuality) return bQuality - aQuality;

  const aCoverage = getPostTreeCoverageScore(a, storiesById, cfg);
  const bCoverage = getPostTreeCoverageScore(b, storiesById, cfg);
  if (bCoverage !== aCoverage) return bCoverage - aCoverage;

  const aWeak = Boolean(a.weakTree);
  const bWeak = Boolean(b.weakTree);
  if (aWeak !== bWeak) return aWeak ? 1 : -1;

  if (b.finalParentScore !== a.finalParentScore) return b.finalParentScore - a.finalParentScore;

  return b.latestSeenAt - a.latestSeenAt;
}

/**
 * Builds and repairs a parent's visible child tree from CE-enriched stories.
 * Inputs are the parent, candidate cluster, shared story map, config, and
 * hidden-id set. The output is ordered children persisted to parent/storiesById;
 * fallback coverage repair is bounded by authority and delta gates.
 */
export function selectChildStoriesForParent(
  parent: InsightParent,
  clusterStories: InsightStory[],
  storiesById: Map<string, InsightStory>,
  cfg: InsightConfig,
  hiddenIds: Set<string>
): InsightStory[] {
  const children = buildChildTree(parent, clusterStories, cfg, hiddenIds);

  const sourceDiversityChildren = enforceSourceDiverseChildSelection(
    parent,
    children,
    clusterStories,
    cfg,
    hiddenIds
  );

  parent.childStoryIds = sourceDiversityChildren.map(child => child.id);

  for (const child of sourceDiversityChildren) {
    storiesById.set(child.id, child);
  }

  const clusterIdSet = new Set(parent.clusterStoryIds);
  parent.hiddenDuplicateIds = [...hiddenIds].filter(id => clusterIdSet.has(id));

  parent.weakTree = isWeakTree(sourceDiversityChildren, cfg);
  computePostTreeQualityScore(parent, storiesById, cfg);

  return sourceDiversityChildren;
}

// ── Top-parent selection with weak tree demotion ──────────────────────────────

export function selectTopParentsWithWeakTreeCheck(
  ranked: InsightParent[],
  storiesById: Map<string, InsightStory>,
  cfg: InsightConfig,
  hiddenIds: Set<string>
): InsightParent[] {
  const evaluated: InsightParent[] = [];

  for (const parent of ranked) {
    const parentClusterStories = getParentClusterStories(parent, storiesById);
    const clusterStories = hasCompleteCEFields(parentClusterStories)
      ? parentClusterStories
      : enrichParentClusterForCE(parent, storiesById, cfg);
    const dedupedCluster = applyPostClusterDeltaDedup(clusterStories, hiddenIds, cfg);

    selectChildStoriesForParent(
      parent,
      dedupedCluster,
      storiesById,
      cfg,
      hiddenIds
    );

    evaluated.push(parent);
  }

  evaluated.sort((a, b) => comparePostTreeParentQuality(a, b, storiesById, cfg));

  const strongTrees = evaluated.filter(parent => !parent.weakTree);
  const weakTrees = evaluated.filter(parent => parent.weakTree);
  const orderedParents = [...strongTrees, ...weakTrees];
  const topParents = orderedParents.slice(0, cfg.TOP_PARENTS);

  if (passesBalancedCoverageFrontier(topParents, storiesById)) {
    return topParents;
  }

  const frontier = selectBalancedCoverageFrontier(orderedParents, storiesById, cfg);
  return frontier || topParents;
}

// ── Incremental update (new "now" stories arrive) ─────────────────────────────

/**
 * Called when a fresh batch of "now" stories arrives between full pipeline runs.
 * Only processes new stories (not already in storiesById).
 * Updates affected parent trees in-place without re-ranking all parents.
 */
export function applyIncrementalUpdate(
  newStories: InsightStory[],
  existingResult: InsightRunResult,
  cfg: InsightConfig
): InsightRunResult {
  const { parents, storiesById, hiddenIds } = existingResult;

  // Only process genuinely new stories
  const truly_new = newStories.filter(s => !storiesById.has(s.id));
  if (truly_new.length === 0) return existingResult;

  // For each new story, find which parent it belongs to (or flag as new parent candidate)

  for (const story of truly_new) {
    storiesById.set(story.id, story);

    // Try to match to an existing parent
    let matched = false;
    for (const parent of parents) {
      const rep = getClusterRepStory(parent, storiesById);
      if (!rep) continue;

      const rawSim = eventSimilarity(story, rep);
      const rule   = applyClusterOverrides(story, rep, rawSim, cfg);

      const sim = rule === "SAME" ? 1.0 : rule === "DIFFERENT" ? 0.0 : rawSim;

      if (sim >= cfg.SAME_EVENT_THRESHOLD) {
        // Belongs to this parent — try to update its tree
        parent.clusterStoryIds.push(story.id);
        parent.latestSeenAt = Math.max(parent.latestSeenAt, story.publishedAt);
        parent.snapshotPresence.now = true;

        const existingClusterStories = parent.clusterStoryIds
          .map(id => storiesById.get(id))
          .filter(Boolean)
          .filter(existing => existing?.id !== story.id) as InsightStory[];
        const anchor = computeEventAnchor(parent, cfg.MAX_STORY_AGE_HOURS);
        story.temporalTier = computeTemporalTier(story.publishedAt, anchor);
        story.temporalTierConfidence = 0.9;
        story.evolutionRole = inferEvolutionRole(
          story,
          story.temporalTier,
          existingClusterStories.filter(existing => existing.publishedAt < story.publishedAt)
        );
        const baseline = existingClusterStories
          .sort((a, b) => a.publishedAt - b.publishedAt)
          .slice(-cfg.MAX_BASELINE_STORIES_FOR_DELTA);
        const delta = extractInformationDelta(story, baseline);
        story.informationDelta = delta;
        story.informationDeltaScore = delta.deltaScore;
        story.repeatedFactPenalty = delta.repeatedFactPenalty;
        storiesById.set(story.id, story);

        const currentChildren = parent.childStoryIds
          .map(id => storiesById.get(id))
          .filter(Boolean) as InsightStory[];

        const updated = tryReplaceWeakestChild(parent, currentChildren, story, cfg, hiddenIds);
        parent.childStoryIds = updated.map(c => c.id);

        // FIX H-4: keep per-parent hidden list in sync after incremental replacement
        const clusterIdSet = new Set(parent.clusterStoryIds);
        parent.hiddenDuplicateIds = [...hiddenIds].filter(id => clusterIdSet.has(id));

        matched = true;
        break;
      }
    }

    // Not matched: new parent candidate (re-run full pipeline at next cycle)
    if (!matched) {
      // Tag for next full run — do not disrupt current output
    }
  }

  // Check for rising badge updates
  for (const parent of parents) {
    const nowCount = parent.clusterStoryIds
      .filter(id => storiesById.get(id)?.capturedAtSnapshot === "now")
      .length;
    parent.isRising = nowCount >= cfg.RISING_THRESHOLD;
  }

  return { ...existingResult, parents, storiesById, hiddenIds };
}

function getClusterRepStory(
  parent: InsightParent,
  storiesById: Map<string, InsightStory>
): InsightStory | null {
  let best: InsightStory | null = null;
  let bestAuth = -1;
  for (const id of parent.clusterStoryIds) {
    const s = storiesById.get(id);
    if (s && s.sourceAuthority > bestAuth) { best = s; bestAuth = s.sourceAuthority; }
  }
  return best;
}

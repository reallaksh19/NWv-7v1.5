import {
  EvolutionRole,
  InsightConfig,
  InsightParent,
  InsightStory,
  TemporalTier,
} from "../types";
import { classifyAngle } from "../dedup/dedup";

const EVOLUTION_DISPLAY_ORDER: EvolutionRole[] = [
  "first_report",
  "corroboration",
  "fact_update",
  "cause_claim",
  "cause_confirmed",
  "official_response",
  "market_reaction",
  "public_reaction",
  "investigation",
  "legal_or_regulatory",
  "accountability",
  "background_context",
  "no_new_information",
];

const TEMPORAL_TIER_ORDER: TemporalTier[] = [
  "breaking",
  "developing",
  "established",
  "reaction",
  "analysis",
  "aftermath",
];

const PROTECTED_SELECTION_ROLES = new Set<EvolutionRole>([
  "fact_update",
  "cause_claim",
  "cause_confirmed",
  "official_response",
  "market_reaction",
  "investigation",
  "legal_or_regulatory",
  "accountability",
]);

export interface SourceDiverseSelectionDiagnostic {
  formulaVersion: string;
  beforeChildCount: number;
  afterChildCount: number;
  beforeSourceGroupCount: number;
  afterSourceGroupCount: number;
  beforeAngleCount: number;
  afterAngleCount: number;
  targetSourceGroupCount: number;
  recoveredCount: number;
  replacedCount: number;
  rejectedCount: number;
  selectedIds: string[];
  recoveredCandidates: Array<{
    id: string;
    angle: string;
    sourceGroup: string;
    score: number;
    action: "add" | "replace";
    replacedId?: string;
    reasons: string[];
  }>;
  rejectedCandidates: Array<{
    id: string;
    angle: string;
    sourceGroup: string;
    score: number;
    reasons: string[];
  }>;
}

export interface CoverageTopUpDiagnostic {
  formulaVersion: string;
  thresholds: {
    minChildCount: number;
    minAngleCount: number;
    minTemporalTierCount: number;
    minSourceAuthority: number;
    minInformationDelta: number;
  };
  before: {
    childCount: number;
    angleCount: number;
    temporalTierCount: number;
  };
  after: {
    childCount: number;
    angleCount: number;
    temporalTierCount: number;
  };
  recoveredCount: number;
  rejectedCount: number;
  selectedIds: string[];
  recoveredCandidates: Array<{
    id: string;
    angle: string;
    sourceGroup: string;
    temporalTier: string;
    score: number;
    action: "add" | "replace";
    replacedId?: string;
    reasons: string[];
  }>;
  rejectedCandidates: Array<{
    id: string;
    angle: string;
    sourceGroup: string;
    temporalTier: string;
    score: number;
    reasons: string[];
  }>;
}

function safeArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function getDebug(parent: InsightParent): any {
  if (!parent.debug) {
    (parent as any).debug = {
      clusterSize: 0,
      hiddenCount: 0,
      matchedSnapshots: [],
      scoreBreakdown: {},
      replacements: [],
    };
  }

  if (!Array.isArray(parent.debug.replacements)) {
    parent.debug.replacements = [];
  }

  return parent.debug as any;
}

function sourceGroup(story: InsightStory): string {
  return story.sourceGroup || story.source || "unknown-source";
}

function angleOf(story: InsightStory): string {
  if (!story.angle) story.angle = classifyAngle(story);
  return story.angle || "unknown";
}

function temporalTierOf(story: InsightStory): string {
  return story.temporalTier || "";
}

function uniqueCount<T>(items: T[], mapper: (item: T) => string): number {
  return new Set(items.map(mapper).filter(Boolean)).size;
}

function countBy<T>(items: T[], mapper: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>();

  for (const item of items) {
    const key = mapper(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return counts;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function finiteNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function targetSourceGroupCount(clusterStories: InsightStory[], cfg: InsightConfig): number {
  const availableSources = uniqueCount(clusterStories, sourceGroup);
  const maxByChildren = Math.min(cfg.MAX_CHILDREN_PER_PARENT, availableSources);

  return Math.min(
    Math.max(2, cfg.MIN_SOURCES_PER_TREE),
    maxByChildren
  );
}

function candidateScore(story: InsightStory, selected: InsightStory[]): number {
  const selectedSources = new Set(selected.map(sourceGroup));
  const selectedAngles = new Set(selected.map(angleOf));
  const selectedRoles = new Set(selected.map(item => item.evolutionRole).filter(Boolean));

  const newSourceBonus = selectedSources.has(sourceGroup(story)) ? 0 : 0.38;
  const newAngleBonus = selectedAngles.has(angleOf(story)) ? 0 : 0.18;
  const newRoleBonus = story.evolutionRole && !selectedRoles.has(story.evolutionRole) ? 0.28 : 0;
  const protectedRoleBonus = story.evolutionRole && PROTECTED_SELECTION_ROLES.has(story.evolutionRole) ? 0.16 : 0;
  const deltaScore = clamp01(Number(story.informationDeltaScore ?? 0.5));
  const domainWeight = story.sourceContentDomain === "business" || story.sourceContentDomain === "regional"
    ? 0.12
    : story.sourceContentDomain ? 0.06 : 0;
  const wirePenalty = story.sourceDistributionType === "wire" ? 0.08 : 0;
  const tierPenalty = story.sourceTier === "D" ? 0.32 : 0;

  return round3(
    0.22 * clamp01(Number(story.sourceAuthority || 0)) +
      0.18 * deltaScore +
      0.16 * clamp01(Number(story.freshnessScore || 0)) +
      0.12 * clamp01(Number(story.rawProminence || 0)) +
      0.10 * clamp01(Number(story.factualDensity || 0)) +
      0.08 * clamp01(Number(story.summaryQuality || 0)) +
      newSourceBonus +
      newAngleBonus -
      wirePenalty +
      newRoleBonus +
      protectedRoleBonus +
      domainWeight -
      tierPenalty
  );
}

function evaluateSourceCandidate(
  candidate: InsightStory,
  selected: InsightStory[],
  cfg: InsightConfig
): { accept: boolean; score: number; reasons: string[] } {
  const reasons: string[] = [];
  const score = candidateScore(candidate, selected);

  const selectedSources = new Set(selected.map(sourceGroup));
  const selectedAngles = new Set(selected.map(angleOf));

  if (candidate.sourceTier === "D" && cfg.TIER_D_EXCLUDE) {
    return {
      accept: false,
      score,
      reasons: ["tier D candidate excluded"],
    };
  }

  if (Number(candidate.sourceAuthority || 0) < 0.35) {
    return {
      accept: false,
      score,
      reasons: ["source authority below source-diversity floor"],
    };
  }

  if (!selectedSources.has(sourceGroup(candidate))) {
    reasons.push("adds new source group: " + sourceGroup(candidate));
  }

  if (!selectedAngles.has(angleOf(candidate))) {
    reasons.push("also adds new angle: " + angleOf(candidate));
  }

  if (candidate.evolutionRole && !selected.some(story => story.evolutionRole === candidate.evolutionRole)) {
    reasons.push("adds evolution role: " + candidate.evolutionRole);
  }

  if ((candidate.informationDeltaScore ?? 0.5) >= 0.35) {
    reasons.push("adds information delta");
  }

  if (
    !reasons.some(reason => reason.startsWith("adds new source group")) &&
    !reasons.some(reason => reason.startsWith("adds evolution role")) &&
    (candidate.informationDeltaScore ?? 0.5) < 0.35
  ) {
    return {
      accept: false,
      score,
      reasons: ["does not improve source or event-evolution diversity"],
    };
  }

  if (score < 0.58) {
    return {
      accept: false,
      score,
      reasons: ["below source-diversity score floor"],
    };
  }

  return {
    accept: true,
    score,
    reasons,
  };
}

function replacementKeepsAngleDiversity(
  selected: InsightStory[],
  outgoing: InsightStory,
  incoming: InsightStory
): boolean {
  const beforeAngleCount = uniqueCount(selected, angleOf);
  const after = selected.map(story => story.id === outgoing.id ? incoming : story);
  const afterAngleCount = uniqueCount(after, angleOf);

  return afterAngleCount >= Math.min(beforeAngleCount, 2);
}

function getReplaceableSourceDuplicate(
  selected: InsightStory[],
  incoming: InsightStory
): InsightStory | null {
  const sourceCounts = countBy(selected, sourceGroup);
  const angleCounts = countBy(selected, angleOf);
  const incomingSource = sourceGroup(incoming);

  const candidates = selected
    .filter(story => sourceGroup(story) !== incomingSource)
    .map(story => {
      const sourceRepeatPenalty = (sourceCounts.get(sourceGroup(story)) || 0) > 1 ? 0.42 : 0;
      const angleRepeatPenalty = (angleCounts.get(angleOf(story)) || 0) > 1 ? 0.18 : 0;

      const quality =
        0.30 * clamp01(Number(story.sourceAuthority || 0)) +
        0.24 * clamp01(Number(story.freshnessScore || 0)) +
        0.18 * clamp01(Number(story.rawProminence || 0)) +
        0.14 * clamp01(Number(story.factualDensity || 0)) +
        0.14 * clamp01(Number(story.summaryQuality || 0));

      return {
        story,
        replaceability: sourceRepeatPenalty + angleRepeatPenalty - quality * 0.18,
      };
    })
    .filter(item => replacementKeepsAngleDiversity(selected, item.story, incoming))
    .sort((a, b) => b.replaceability - a.replaceability);

  return candidates[0]?.story || null;
}

function annotateRecovered(story: InsightStory, reasons: string[], score: number): InsightStory {
  (story as any).admittedBecause = [
    "source-diverse child selection",
    ...reasons,
  ];

  (story as any).childScore = Math.max(
    Number((story as any).childScore || 0),
    score
  );

  (story as any).informationGain = Math.max(
    Number((story as any).informationGain || 0),
    reasons.some(reason => reason.startsWith("adds new source group")) ? 0.52 : 0.30
  );

  return story;
}

function annotateCoverageRecovered(story: InsightStory, reasons: string[], score: number): InsightStory {
  (story as any).admittedBecause = [
    "coverage top-up child selection",
    ...reasons,
  ];

  (story as any).childScore = Math.max(
    Number((story as any).childScore || 0),
    score
  );

  (story as any).informationGain = Math.max(
    Number((story as any).informationGain || 0),
    Math.max(0.10, finiteNumber(story.informationDeltaScore))
  );

  return story;
}

function buildChildInsightLabel(story: InsightStory): string {
  switch (story.evolutionRole) {
    case "first_report": return "Breaking";
    case "fact_update": return "New fact";
    case "cause_claim": return "Cause reported";
    case "cause_confirmed": return "Cause confirmed";
    case "official_response": return "Official statement";
    case "market_reaction": return "Market impact";
    case "public_reaction": return "Public reaction";
    case "investigation": return "Investigation";
    case "legal_or_regulatory": return "Legal/regulatory";
    case "accountability": return "Accountability";
    default: return "Context";
  }
}

function buildTimeOffsetLabel(story: InsightStory, anchor: number): string {
  const hours = Math.round((story.publishedAt - anchor) / 3600000);
  if (hours < 1) return "T+0";
  if (hours < 24) return `T+${hours}h`;
  return `T+${Math.round(hours / 24)}d`;
}

function annotateChildInsightFields(
  stories: InsightStory[],
  parent: InsightParent
): InsightStory[] {
  const anchor = Number.isFinite(parent.firstSeenAt)
    ? parent.firstSeenAt
    : Math.min(...stories.map(story => story.publishedAt));

  for (const story of stories) {
    story.childInsightLabel = buildChildInsightLabel(story);
    story.childTimeOffsetLabel = buildTimeOffsetLabel(story, anchor);
    story.childInsightSummary = story.informationDeltaScore !== undefined
      ? `Selected for ${story.evolutionRole || "context"} with delta ${round3(story.informationDeltaScore)}.`
      : `Selected for ${story.evolutionRole || angleOf(story)}.`;
  }

  return stories;
}

function getCoverageCounts(selected: InsightStory[]): {
  childCount: number;
  angleCount: number;
  temporalTierCount: number;
} {
  return {
    childCount: selected.length,
    angleCount: uniqueCount(selected, angleOf),
    temporalTierCount: uniqueCount(selected, temporalTierOf),
  };
}

function needsCoverageTopUp(selected: InsightStory[]): boolean {
  const counts = getCoverageCounts(selected);

  // Target 3 children (matching WEAK_TREE_CHILD_MIN) so repaired trees are not
  // still flagged weak. Angle and tier targets are 2 — the minimum for meaningful
  // diversity. If the cluster lacks enough usable candidates the while-loop in
  // applyCoverageTopUpPass exits naturally when no accepted candidate is found.
  return counts.childCount < 3 ||
    counts.angleCount < 2 ||
    counts.temporalTierCount < 2;
}

function getCoverageTopUpReasons(story: InsightStory, selected: InsightStory[]): string[] {
  const counts = getCoverageCounts(selected);
  const selectedAngles = new Set(selected.map(angleOf));
  const selectedTemporalTiers = new Set(selected.map(temporalTierOf).filter(Boolean));
  const reasons: string[] = [];
  const angle = angleOf(story);
  const temporalTier = temporalTierOf(story);

  if (counts.childCount < 2) {
    reasons.push("adds child depth");
  }

  if (counts.angleCount < 2 && !selectedAngles.has(angle)) {
    reasons.push("adds missing angle: " + angle);
  }

  if (counts.temporalTierCount < 2 && temporalTier && !selectedTemporalTiers.has(temporalTier)) {
    reasons.push("adds missing temporal tier: " + temporalTier);
  }

  return reasons;
}

function evaluateCoverageTopUpCandidate(
  story: InsightStory,
  selected: InsightStory[],
  cfg: InsightConfig
): { accept: boolean; score: number; reasons: string[] } {
  const reasons = getCoverageTopUpReasons(story, selected);
  const sourceAuthority = finiteNumber(story.sourceAuthority);
  const informationDelta = finiteNumber(story.informationDeltaScore);
  const selectedSources = new Set(selected.map(sourceGroup));
  const selectedRoles = new Set(selected.map(item => item.evolutionRole).filter(Boolean));
  const hasAngleGain = reasons.some(reason => reason.startsWith("adds missing angle"));
  const hasTierGain = reasons.some(reason => reason.startsWith("adds missing temporal tier"));
  const onlyChildDepthGain = reasons.length === 1 && reasons[0] === "adds child depth";
  let score = candidateScore(story, selected);

  if (reasons.some(reason => reason === "adds child depth")) score += 0.18;
  if (hasAngleGain) score += 0.34;
  if (hasTierGain) score += 0.28;
  if (!selectedSources.has(sourceGroup(story))) score += 0.08;
  if (story.evolutionRole && !selectedRoles.has(story.evolutionRole)) score += 0.08;
  score = round3(score);

  if (story.sourceTier === "D" && cfg.TIER_D_EXCLUDE) {
    return {
      accept: false,
      score,
      reasons: ["tier D candidate excluded"],
    };
  }

  if (sourceAuthority < 0.35) {
    return {
      accept: false,
      score,
      reasons: ["source authority below coverage top-up floor"],
    };
  }

  if (informationDelta < 0.10) {
    return {
      accept: false,
      score,
      reasons: ["information delta below coverage top-up floor"],
    };
  }

  if (reasons.length === 0) {
    return {
      accept: false,
      score,
      reasons: ["does not improve child, angle, or temporal-tier coverage"],
    };
  }

  if (angleOf(story) === "base_report" && onlyChildDepthGain) {
    return {
      accept: false,
      score,
      reasons: ["base report only adds child depth"],
    };
  }

  return {
    accept: true,
    score,
    reasons,
  };
}

function createCoverageTopUpDiagnostic(selected: InsightStory[]): CoverageTopUpDiagnostic {
  const before = getCoverageCounts(selected);

  return {
    formulaVersion: "coverage-top-up-v1",
    thresholds: {
      minChildCount: 3,
      minAngleCount: 2,
      minTemporalTierCount: 2,
      minSourceAuthority: 0.35,
      minInformationDelta: 0.10,
    },
    before,
    after: before,
    recoveredCount: 0,
    rejectedCount: 0,
    selectedIds: selected.map(story => story.id),
    recoveredCandidates: [],
    rejectedCandidates: [],
  };
}

function recordCoverageTopUpRejection(
  diagnostics: CoverageTopUpDiagnostic,
  story: InsightStory,
  score: number,
  reasons: string[],
  rejectedIds: Set<string>
): void {
  if (rejectedIds.has(story.id)) return;
  rejectedIds.add(story.id);
  diagnostics.rejectedCount += 1;

  if (diagnostics.rejectedCandidates.length >= 50) return;

  diagnostics.rejectedCandidates.push({
    id: story.id,
    angle: angleOf(story),
    sourceGroup: sourceGroup(story),
    temporalTier: temporalTierOf(story) || "unknown",
    score,
    reasons,
  });
}

/**
 * Finds the weakest non-protected child that can be swapped out when the tree
 * is full. Prefers redundant roles/angles; penalises high quality to protect them.
 */
function getCoverageReplaceableChild(selected: InsightStory[]): InsightStory | null {
  const roleCounts = countBy(selected, story => story.evolutionRole || "no_new_information");
  const angleCounts = countBy(selected, angleOf);

  const candidates = selected
    .filter(story => !story.evolutionRole || !PROTECTED_SELECTION_ROLES.has(story.evolutionRole))
    .map(story => {
      const roleRedundancy = (roleCounts.get(story.evolutionRole || "no_new_information") || 0) > 1 ? 0.30 : 0;
      const angleRedundancy = (angleCounts.get(angleOf(story)) || 0) > 1 ? 0.20 : 0;
      const qualityScore =
        0.35 * clamp01(Number(story.sourceAuthority || 0)) +
        0.30 * clamp01(Number(story.informationDeltaScore ?? 0.5)) +
        0.20 * clamp01(Number(story.freshnessScore || 0)) +
        0.15 * clamp01(Number(story.summaryQuality || 0));
      return {
        story,
        // High redundancy + low quality = most replaceable
        replaceability: roleRedundancy + angleRedundancy - qualityScore * 0.5,
      };
    })
    .sort((a, b) => b.replaceability - a.replaceability);

  return candidates[0]?.story || null;
}

function applyCoverageTopUpPass(
  selected: InsightStory[],
  cluster: InsightStory[],
  cfg: InsightConfig,
  hiddenIds: Set<string>,
  debug: any
): void {
  const diagnostics = createCoverageTopUpDiagnostic(selected);
  const rejectedIds = new Set<string>();
  debug.coverageTopUpDiagnostics = diagnostics;

  // Guard: max iterations = cluster size to prevent infinite loops if evaluation
  // is inconsistent. In practice the loop exits much earlier via break or !best.
  let safetyBudget = cluster.length + 1;

  while (needsCoverageTopUp(selected) && safetyBudget-- > 0) {
    const treeFull = selected.length >= cfg.MAX_CHILDREN_PER_PARENT;
    const selectedIds = new Set(selected.map(story => story.id));
    const candidates = cluster
      .filter(story => !selectedIds.has(story.id))
      .map(story => ({
        story,
        decision: evaluateCoverageTopUpCandidate(story, selected, cfg),
      }))
      .sort((a, b) => {
        if (b.decision.score !== a.decision.score) {
          return b.decision.score - a.decision.score;
        }
        if (b.story.sourceAuthority !== a.story.sourceAuthority) {
          return b.story.sourceAuthority - a.story.sourceAuthority;
        }
        return b.story.freshnessScore - a.story.freshnessScore;
      });

    for (const item of candidates) {
      if (item.decision.accept) continue;
      recordCoverageTopUpRejection(
        diagnostics,
        item.story,
        item.decision.score,
        item.decision.reasons,
        rejectedIds
      );
    }

    const best = candidates.find(item => item.decision.accept);
    if (!best) break;

    const recovered = annotateCoverageRecovered(
      best.story,
      best.decision.reasons,
      best.decision.score
    );

    if (!treeFull) {
      // Room available — add directly.
      selected.push(recovered);
      hiddenIds.delete(recovered.id);
      diagnostics.recoveredCount += 1;
      diagnostics.recoveredCandidates.push({
        id: recovered.id,
        angle: angleOf(recovered),
        sourceGroup: sourceGroup(recovered),
        temporalTier: temporalTierOf(recovered) || "unknown",
        score: best.decision.score,
        action: "add",
        reasons: best.decision.reasons,
      });
    } else {
      // Tree full — replace the weakest non-protected duplicate to make room
      // while preserving existing protected roles.
      const replaceTarget = getCoverageReplaceableChild(selected);
      if (!replaceTarget) break;

      const index = selected.findIndex(child => child.id === replaceTarget.id);
      if (index < 0) break;

      selected[index] = recovered;
      hiddenIds.add(replaceTarget.id);
      hiddenIds.delete(recovered.id);

      diagnostics.recoveredCount += 1;
      diagnostics.recoveredCandidates.push({
        id: recovered.id,
        angle: angleOf(recovered),
        sourceGroup: sourceGroup(recovered),
        temporalTier: temporalTierOf(recovered) || "unknown",
        score: best.decision.score,
        action: "replace",
        replacedId: replaceTarget.id,
        reasons: best.decision.reasons,
      });
    }
  }

  diagnostics.after = getCoverageCounts(selected);
  diagnostics.selectedIds = selected.map(story => story.id);
}

function finalizeSelection(
  parent: InsightParent,
  selected: InsightStory[],
  cluster: InsightStory[],
  cfg: InsightConfig,
  hiddenIds: Set<string>,
  diagnostics: SourceDiverseSelectionDiagnostic,
  debug: any
): InsightStory[] {
  applyCoverageTopUpPass(selected, cluster, cfg, hiddenIds, debug);

  diagnostics.afterChildCount = selected.length;
  diagnostics.afterSourceGroupCount = uniqueCount(selected, sourceGroup);
  diagnostics.afterAngleCount = uniqueCount(selected, angleOf);
  diagnostics.selectedIds = selected.map(story => story.id);

  return annotateChildInsightFields(orderChildrenForDisplay(selected), parent);
}

function getReplaceableEvolutionRoleChild(selected: InsightStory[]): InsightStory | null {
  const roleCounts = countBy(selected, story => story.evolutionRole || "no_new_information");
  const candidates = selected
    .filter(story => !story.evolutionRole || !PROTECTED_SELECTION_ROLES.has(story.evolutionRole))
    .map(story => ({
      story,
      replaceability:
        ((roleCounts.get(story.evolutionRole || "no_new_information") || 0) > 1 ? 0.35 : 0) -
        0.25 * clamp01(Number(story.sourceAuthority || 0)) -
        0.20 * clamp01(Number(story.informationDeltaScore ?? 0.5)) -
        0.15 * clamp01(Number(story.freshnessScore || 0)),
    }))
    .sort((a, b) => b.replaceability - a.replaceability);

  return candidates[0]?.story || null;
}

function applyEvolutionRoleCoveragePass(
  selected: InsightStory[],
  cluster: InsightStory[],
  cfg: InsightConfig,
  hiddenIds: Set<string>,
  diagnostics: SourceDiverseSelectionDiagnostic,
  debug: any
): void {
  const selectedIds = new Set(selected.map(story => story.id));
  const selectedRoles = new Set(selected.map(story => story.evolutionRole).filter(Boolean));
  const candidates = cluster
    .filter(story => !selectedIds.has(story.id))
    .filter(story => Boolean(story.evolutionRole && PROTECTED_SELECTION_ROLES.has(story.evolutionRole)))
    .filter(story => !selectedRoles.has(story.evolutionRole))
    .map(story => ({
      story,
      score: candidateScore(story, selected),
      reasons: [
        "adds protected evolution role: " + story.evolutionRole,
        `information delta: ${round3(story.informationDeltaScore ?? 0.5)}`,
      ],
    }))
    .filter(item => item.score >= 0.50 && (item.story.informationDeltaScore ?? 0.5) >= 0.10)
    .sort((a, b) => b.score - a.score);

  for (const item of candidates) {
    if (selected.some(story => story.evolutionRole === item.story.evolutionRole)) continue;
    const recovered = annotateRecovered(item.story, item.reasons, item.score);

    if (selected.length < cfg.MAX_CHILDREN_PER_PARENT) {
      selected.push(recovered);
      hiddenIds.delete(recovered.id);
      diagnostics.recoveredCount += 1;
      diagnostics.recoveredCandidates.push({
        id: recovered.id,
        angle: angleOf(recovered),
        sourceGroup: sourceGroup(recovered),
        score: item.score,
        action: "add",
        reasons: item.reasons,
      });
      continue;
    }

    const replaceTarget = getReplaceableEvolutionRoleChild(selected);
    if (!replaceTarget) {
      diagnostics.rejectedCount += 1;
      diagnostics.rejectedCandidates.push({
        id: recovered.id,
        angle: angleOf(recovered),
        sourceGroup: sourceGroup(recovered),
        score: item.score,
        reasons: ["no replaceable non-protected child for evolution role coverage"],
      });
      continue;
    }

    const index = selected.findIndex(child => child.id === replaceTarget.id);
    if (index < 0) continue;

    selected[index] = recovered;
    hiddenIds.add(replaceTarget.id);
    hiddenIds.delete(recovered.id);
    diagnostics.recoveredCount += 1;
    diagnostics.replacedCount += 1;
    diagnostics.recoveredCandidates.push({
      id: recovered.id,
      angle: angleOf(recovered),
      sourceGroup: sourceGroup(recovered),
      score: item.score,
      action: "replace",
      replacedId: replaceTarget.id,
      reasons: item.reasons,
    });
    debug.replacements.push({
      replacedId: replaceTarget.id,
      replacedBy: recovered.id,
      reason: "evolution role coverage: " + item.reasons.join(", "),
    });
  }
}

export function enforceSourceDiverseChildSelection(
  parent: InsightParent,
  selectedChildren: InsightStory[],
  clusterStories: InsightStory[],
  cfg: InsightConfig,
  hiddenIds: Set<string>
): InsightStory[] {
  const selected = [...safeArray(selectedChildren)];
  const cluster = safeArray(clusterStories);

  for (const story of selected) angleOf(story);
  for (const story of cluster) angleOf(story);

  const target = targetSourceGroupCount(cluster, cfg);
  const beforeSourceGroupCount = uniqueCount(selected, sourceGroup);
  const beforeAngleCount = uniqueCount(selected, angleOf);

  const diagnostics: SourceDiverseSelectionDiagnostic = {
    formulaVersion: "source-diverse-child-selection-v1",
    beforeChildCount: selected.length,
    afterChildCount: selected.length,
    beforeSourceGroupCount,
    afterSourceGroupCount: beforeSourceGroupCount,
    beforeAngleCount,
    afterAngleCount: beforeAngleCount,
    targetSourceGroupCount: target,
    recoveredCount: 0,
    replacedCount: 0,
    rejectedCount: 0,
    selectedIds: selected.map(story => story.id),
    recoveredCandidates: [],
    rejectedCandidates: [],
  };

  const debug = getDebug(parent);
  debug.sourceDiverseSelectionDiagnostics = diagnostics;

  applyEvolutionRoleCoveragePass(selected, cluster, cfg, hiddenIds, diagnostics, debug);

  if (uniqueCount(selected, sourceGroup) >= target) {
    return finalizeSelection(parent, selected, cluster, cfg, hiddenIds, diagnostics, debug);
  }

  const selectedIds = new Set(selected.map(story => story.id));

  const remaining = cluster
    .filter(story => !selectedIds.has(story.id))
    .map(story => ({
      story,
      decision: evaluateSourceCandidate(story, selected, cfg),
    }))
    .sort((a, b) => b.decision.score - a.decision.score);

  for (const item of remaining) {
    if (uniqueCount(selected, sourceGroup) >= target) break;

    const { story, decision } = item;

    if (!decision.accept) {
      diagnostics.rejectedCount += 1;
      diagnostics.rejectedCandidates.push({
        id: story.id,
        angle: angleOf(story),
        sourceGroup: sourceGroup(story),
        score: decision.score,
        reasons: decision.reasons,
      });
      continue;
    }

    const recovered = annotateRecovered(story, decision.reasons, decision.score);

    if (selected.length < cfg.MAX_CHILDREN_PER_PARENT) {
      selected.push(recovered);
      hiddenIds.delete(recovered.id);

      diagnostics.recoveredCount += 1;
      diagnostics.recoveredCandidates.push({
        id: recovered.id,
        angle: angleOf(recovered),
        sourceGroup: sourceGroup(recovered),
        score: decision.score,
        action: "add",
        reasons: decision.reasons,
      });
      continue;
    }

    const replaceTarget = getReplaceableSourceDuplicate(selected, recovered);

    if (!replaceTarget) {
      diagnostics.rejectedCount += 1;
      diagnostics.rejectedCandidates.push({
        id: story.id,
        angle: angleOf(story),
        sourceGroup: sourceGroup(story),
        score: decision.score,
        reasons: ["no replaceable same-source-heavy child without reducing angle diversity"],
      });
      continue;
    }

    const index = selected.findIndex(child => child.id === replaceTarget.id);
    if (index < 0) continue;

    selected[index] = recovered;
    hiddenIds.add(replaceTarget.id);
    hiddenIds.delete(recovered.id);

    debug.replacements.push({
      replacedId: replaceTarget.id,
      replacedBy: recovered.id,
      reason: "source-diverse child selection: " + decision.reasons.join(", "),
    });

    diagnostics.recoveredCount += 1;
    diagnostics.replacedCount += 1;
    diagnostics.recoveredCandidates.push({
      id: recovered.id,
      angle: angleOf(recovered),
      sourceGroup: sourceGroup(recovered),
      score: decision.score,
      action: "replace",
      replacedId: replaceTarget.id,
      reasons: decision.reasons,
    });
  }

  return finalizeSelection(parent, selected, cluster, cfg, hiddenIds, diagnostics, debug);
}

export function orderChildrenForDisplay(stories: InsightStory[]): InsightStory[] {
  return [...stories].sort((a, b) => {
    const aRoleIdx = EVOLUTION_DISPLAY_ORDER.indexOf(a.evolutionRole ?? "no_new_information");
    const bRoleIdx = EVOLUTION_DISPLAY_ORDER.indexOf(b.evolutionRole ?? "no_new_information");
    if (aRoleIdx !== bRoleIdx) return aRoleIdx - bRoleIdx;

    const aTierIdx = TEMPORAL_TIER_ORDER.indexOf(a.temporalTier ?? "breaking");
    const bTierIdx = TEMPORAL_TIER_ORDER.indexOf(b.temporalTier ?? "breaking");
    if (aTierIdx !== bTierIdx) return aTierIdx - bTierIdx;

    const aDelta = a.informationDeltaScore ?? 0.5;
    const bDelta = b.informationDeltaScore ?? 0.5;
    if (Math.abs(bDelta - aDelta) > 0.05) return bDelta - aDelta;

    return b.sourceAuthority - a.sourceAuthority;
  });
}

export function orderSourceDiverseChildrenForDisplay(stories: InsightStory[]): InsightStory[] {
  return orderChildrenForDisplay(stories);
}

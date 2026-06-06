// ─────────────────────────────────────────────
//  INSIGHT TAB — Core Types
// ─────────────────────────────────────────────

export type SourceTier = "A" | "B" | "C" | "D";

export type SourceDistributionType =
  | "wire"
  | "publisher"
  | "aggregator"
  | "official"
  | "unknown";

export type SourceContentDomain =
  | "general"
  | "business"
  | "regional"
  | "tech"
  | "sports"
  | "opinion"
  | "official"
  | "legal"
  | "unknown";

export type TemporalTier =
  | "breaking"
  | "developing"
  | "established"
  | "reaction"
  | "analysis"
  | "aftermath";

export type EvolutionRole =
  | "first_report"
  | "corroboration"
  | "fact_update"
  | "cause_claim"
  | "cause_confirmed"
  | "official_response"
  | "market_reaction"
  | "public_reaction"
  | "investigation"
  | "legal_or_regulatory"
  | "accountability"
  | "background_context"
  | "no_new_information";

export type EventArchetype =
  | "accident_disaster"
  | "election_result"
  | "financial_scandal"
  | "scam_fraud"
  | "policy_decision"
  | "sports_match"
  | "market_event"
  | "legal_case"
  | "generic";

export type SnapshotSlot =
  | "now"
  | "minus4h"
  | "minus12h"
  | "minus24h"
  | "minus36h"
  | "minus48h";

export const SNAPSHOT_SLOTS: SnapshotSlot[] = [
  "now",
  "minus4h",
  "minus12h",
  "minus24h",
  "minus36h",
  "minus48h",
];

export const PREWARM_SLOTS: SnapshotSlot[] = [
  "minus4h",
  "minus12h",
  "minus24h",
  "minus36h",
  "minus48h",
];

export type AngleLabel =
  | "base_report"
  | "official_response"
  | "market_reaction"
  | "fact_update"
  | "expert_analysis"
  | "regional_followup"
  | "correction"
  | "background_context"
  | "reaction_public"
  | "investigative_detail"
  | "opinion_editorial"
  | "unknown";

export type StoryBucket =
  | "DUPLICATE_OF_EXISTING_CHILD"
  | "ADD_AS_CHILD_TO_EXISTING_PARENT"
  | "MERGE_INTO_PARENT_CANDIDATE_POOL"
  | "NEW_PARENT_CANDIDATE";

export type Confidence = "HIGH" | "MEDIUM" | "LOW" | "WARN";

export interface InformationDelta {
  deltaScore: number;
  newNumbers: string[];
  newEntities: string[];
  newKeywords: string[];
  repeatedFactPenalty: number;
}

// ── Raw story as ingested from a news source ──────────────────────────────────

export interface RawStory {
  id: string;
  title: string;
  summary: string;
  source: string;
  sourceGroup: string;       // e.g. "reuters_group", "toi_group"
  url: string;
  publishedAt: number;       // epoch ms
  category?: string;
  region?: string;
  language?: string;
  feedPosition?: number;
  feedLength?: number;
}

// ── Normalized story after enrichment ────────────────────────────────────────

export interface InsightStory extends RawStory {
  capturedAtSnapshot: SnapshotSlot;
  canonicalUrl: string;
  canonicalText: string;     // normalized title + summary
  canonicalTextHash: string;

  entities: {
    people: string[];
    orgs: string[];
    places: string[];
    products: string[];
    symbols: string[];
  };

  keywords: string[];
  embedding: number[];       // dense vector, e.g. 384-dim
  eventVerbs: string[];      // e.g. ["launches", "bans", "acquires"]
  numbers: string[];         // extracted numeric facts, e.g. ["₹4200Cr", "18%"]

  sourceTier: SourceTier;
  sourceDistributionType: SourceDistributionType;
  sourceContentDomain: SourceContentDomain;
  sectionDomain?: SourceContentDomain;
  correctionMarker?: boolean;
  trustScore?: number;
  sourceAuthority: number;   // 0..1, derived from tier + editorial score
  freshnessScore: number;    // 0..1, from recency decay
  rawProminence: number;     // 0..1, from source placement / headline rank
  sentiment: number;         // -1..1
  factualDensity: number;    // 0..1, entity+number density
  summaryQuality: number;    // 0..1, length + completeness heuristic

  angle?: AngleLabel;
  bucket?: StoryBucket;
  parentId?: string;
  temporalTier?: TemporalTier;
  temporalTierConfidence?: number;
  evolutionRole?: EvolutionRole;
  evolutionRoleConfidence?: number;
  informationDelta?: InformationDelta;
  informationDeltaScore?: number;
  repeatedFactPenalty?: number;
  childInsightLabel?: string;
  childTimeOffsetLabel?: string;
  childInsightSummary?: string;
  structuralClusterId?: string;
  resolverDiagnostics?: {
    angleSource: "keyword" | "domain" | "temporal" | "llm" | "fallback";
    roleSource: "heuristic" | "llm" | "fallback";
    confidence: number;
    evidence: string[];
  };
}

// ── Parent insight cluster ────────────────────────────────────────────────────

export interface InsightParent {
  parentId: string;
  canonicalHeadline: string;
  canonicalSummary: string;

  clusterStoryIds: string[];
  childStoryIds: string[];           // selected, max 7
  hiddenDuplicateIds: string[];

  keyEntities: string[];
  keyPlaces: string[];
  keyVerbs: string[];
  keyNumbers: string[];

  firstSeenAt: number;
  latestSeenAt: number;

  snapshotPresence: Record<SnapshotSlot, boolean>;

  // scores
  impactScore: number;
  persistenceScore: number;
  sourceDiversityScore: number;
  noveltyScore: number;
  freshnessScore: number;
  crossSnapshotMomentum: number;
  editorialClarityScore: number;
  regionBoost: number;
  timelineCompletenessScore: number;
  evolutionDiversityScore: number;
  informationDeltaScore: number;
  wirePenaltyScore: number;
  finalParentScore: number;

  isRising: boolean;
  weakTree: boolean;
  eventArchetype?: EventArchetype;

  debug: ParentDebug;
}

export interface ParentDebug {
  clusterSize: number;
  hiddenCount: number;
  matchedSnapshots: SnapshotSlot[];
  scoreBreakdown: Record<string, number>;
  replacements: Array<{ replacedId: string; replacedBy: string; reason: string }>;
  representativeDiagnostics?: any;
}

// ── Child candidate (internal, during tree build) ────────────────────────────

export interface ChildCandidate {
  story: InsightStory;
  angle: AngleLabel;
  relevanceToParent: number;
  informationGain: number;
  sourceDiversityBonus: number;
  angleUniqueness: number;
  childScore: number;
  admittedBecause?: string[];
}

// ── Cache entry ───────────────────────────────────────────────────────────────

export interface SnapshotCacheEntry {
  slot: SnapshotSlot;
  fetchedAt: number;         // epoch ms
  stories: InsightStory[];
  parents?: InsightParent[]; // if full pipeline was cached
  ttlMs: number;
}

// ── Pipeline config (all tunable constants) ───────────────────────────────────

export interface InsightConfig {
  TOP_PARENTS: number;
  MAX_CHILDREN_PER_PARENT: number;

  HARD_DUP_TITLE_SIM: number;
  HARD_DUP_EMBED_SIM: number;
  SAME_EVENT_THRESHOLD: number;
  POSSIBLE_EVENT_THRESHOLD: number;

  MIN_CHILD_INFO_GAIN: number;
  REPLACE_MARGIN: number;

  MAX_PER_SOURCE_GROUP: number;
  MAX_PER_ANGLE: number;
  MIN_SOURCES_PER_TREE: number;
  WEAK_TREE_CHILD_MIN: number;

  STALE_PENALTY_PER_HOUR: number;
  PREWARM_BEFORE_TTL_MS: number;
  MAX_STORY_AGE_HOURS: number;

  CACHE_TTL: Record<SnapshotSlot, number>;         // ms
  CACHE_TOLERANCE: Record<SnapshotSlot, number>;   // ms

  RISING_THRESHOLD: number;
  REGION_BOOST: number;
  REGION_TAGS: string[];

  TIER_D_EXCLUDE: boolean;
  TIER_C_FALLBACK: boolean;
  DOMAIN_DIVERSITY_WEIGHT: Record<SourceContentDomain, number>;
  WIRE_DOMAIN_DIVERSITY_PENALTY: number;
  INSIGHT_CE_MODEL: "off" | "shadow" | "on";
  INSIGHT_SELECTOR_MODE: "legacy" | "ce";
  MAX_CLUSTER_STORIES_FOR_DELTA: number;
  MAX_BASELINE_STORIES_FOR_DELTA: number;
}

const env = ((globalThis as any).process?.env ?? {}) as Record<string, string | undefined>;

export const DEFAULT_CONFIG: InsightConfig = {
  TOP_PARENTS: 10,
  MAX_CHILDREN_PER_PARENT: 7,

  HARD_DUP_TITLE_SIM: 0.96,
  HARD_DUP_EMBED_SIM: 0.985,
  SAME_EVENT_THRESHOLD: 0.88,
  POSSIBLE_EVENT_THRESHOLD: 0.75,

  MIN_CHILD_INFO_GAIN: 0.10,
  REPLACE_MARGIN: 0.08,

  MAX_PER_SOURCE_GROUP: 2,
  MAX_PER_ANGLE: 3,
  MIN_SOURCES_PER_TREE: 3,
  WEAK_TREE_CHILD_MIN: 3,

  STALE_PENALTY_PER_HOUR: 0.08,
  PREWARM_BEFORE_TTL_MS: 55 * 60 * 1000,
  MAX_STORY_AGE_HOURS: 48,

  CACHE_TTL: {
    now:       0,
    minus4h:   60  * 60 * 1000,
    minus12h:  90  * 60 * 1000,
    minus24h:  120 * 60 * 1000,
    minus36h:  150 * 60 * 1000,
    minus48h:  180 * 60 * 1000,
  },
  CACHE_TOLERANCE: {
    now:       0,
    minus4h:   60  * 60 * 1000,
    minus12h:  120 * 60 * 1000,
    minus24h:  240 * 60 * 1000,
    minus36h:  300 * 60 * 1000,
    minus48h:  360 * 60 * 1000,
  },

  RISING_THRESHOLD: 3,
  REGION_BOOST: 0.03,
  REGION_TAGS: ["chennai", "trichy", "tamil nadu", "tn", "muscat", "oman"],

  TIER_D_EXCLUDE: true,
  TIER_C_FALLBACK: true,
  DOMAIN_DIVERSITY_WEIGHT: {
    general: 0.25,
    business: 0.70,
    regional: 0.65,
    tech: 0.55,
    sports: 0.55,
    opinion: 0.45,
    official: 0.60,
    legal: 0.60,
    unknown: 0.25,
  },
  WIRE_DOMAIN_DIVERSITY_PENALTY: 0.30,
  INSIGHT_CE_MODEL: (env.INSIGHT_CE_MODEL as "off" | "shadow" | "on") ?? "off",
  INSIGHT_SELECTOR_MODE: (env.INSIGHT_SELECTOR_MODE as "legacy" | "ce") ?? "legacy",
  MAX_CLUSTER_STORIES_FOR_DELTA: 80,
  MAX_BASELINE_STORIES_FOR_DELTA: 20,
};

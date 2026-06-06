import {
  EvolutionRole,
  InsightConfig,
  InsightParent,
  InsightStory,
  TemporalTier,
} from "../types";

const TIER_ORDER: Array<{ tier: TemporalTier; maxHours: number }> = [
  { tier: "breaking", maxHours: 1 },
  { tier: "developing", maxHours: 4 },
  { tier: "established", maxHours: 12 },
  { tier: "reaction", maxHours: 24 },
  { tier: "analysis", maxHours: 36 },
  { tier: "aftermath", maxHours: 48 },
];

function storyText(story: InsightStory): string {
  return `${story.title || ""} ${story.summary || ""}`.toLowerCase();
}

function matchSignals(text: string, patterns: RegExp[]): string[] {
  return patterns
    .filter(pattern => pattern.test(text))
    .map(pattern => pattern.source);
}

/**
 * Computes the event anchor used for temporal tiers. Inputs are a parent and
 * configured age window; output is the earliest known event timestamp.
 */
export function computeEventAnchor(parent: InsightParent, maxStoryAgeHours: number): number {
  const windowStart = Date.now() - maxStoryAgeHours * 60 * 60 * 1000;
  if (!Number.isFinite(parent.firstSeenAt)) return windowStart;
  return parent.firstSeenAt < windowStart ? windowStart : parent.firstSeenAt;
}

/**
 * Converts story time into a stable event-evolution tier. Inputs are epoch-ms
 * timestamps; output is a bounded TemporalTier with no fallback network calls.
 */
export function computeTemporalTier(publishedAt: number, anchor: number): TemporalTier {
  const elapsedHours = Math.max(0, (publishedAt - anchor) / (60 * 60 * 1000));
  const match = TIER_ORDER.find(item => elapsedHours <= item.maxHours);
  return match?.tier ?? "aftermath";
}

/**
 * Infers the story's role in the event arc from text, time, domain, and prior
 * cluster state. Inputs are already-normalized stories; output is an evolution role.
 */
export function inferEvolutionRole(
  story: InsightStory,
  tier: TemporalTier,
  priorStories: InsightStory[]
): EvolutionRole {
  const text = storyText(story);
  const signals: Array<{ role: EvolutionRole; patterns: RegExp[] }> = [
    {
      role: "cause_confirmed",
      patterns: [/confirmed .*cause/i, /cause .*confirmed/i, /official .*cause/i],
    },
    {
      role: "cause_claim",
      patterns: [/cause/i, /triggered by/i, /due to/i, /linked to/i, /blamed on/i],
    },
    {
      role: "fact_update",
      patterns: [/toll/i, /rises?/i, /climbs?/i, /updated/i, /latest/i, /new data/i, /\b\d+\s+(dead|killed|injured|missing|crore|million|billion)\b/i],
    },
    {
      role: "official_response",
      patterns: [/minister/i, /ministry/i, /official/i, /regulator/i, /government/i, /court/i, /statement/i, /police (confirmed|announced|ordered)/i, /officials? (confirmed|announced|ordered)/i],
    },
    {
      role: "market_reaction",
      patterns: [/shares?/i, /stocks?/i, /market/i, /nifty/i, /sensex/i, /rupee/i, /investors?/i],
    },
    {
      role: "investigation",
      patterns: [/investigation/i, /probe/i, /inquiry/i, /audit/i, /exclusive/i, /documents? show/i],
    },
    {
      role: "legal_or_regulatory",
      patterns: [/court/i, /lawsuit/i, /legal/i, /regulator/i, /sebi/i, /rbi/i, /penalty/i],
    },
    {
      role: "accountability",
      patterns: [/resign/i, /suspended/i, /arrest/i, /charged/i, /held accountable/i],
    },
    {
      role: "public_reaction",
      patterns: [/protest/i, /backlash/i, /families/i, /residents/i, /locals/i, /social media/i, /public reaction/i],
    },
    {
      role: "background_context",
      patterns: [/background/i, /explainer/i, /timeline/i, /why it matters/i, /what happened/i],
    },
  ];

  for (const candidate of signals) {
    const evidence = matchSignals(text, candidate.patterns);
    if (evidence.length > 0) {
      story.evolutionRoleConfidence = 0.75;
      story.resolverDiagnostics = {
        roleSource: "heuristic",
        angleSource: story.angle ? "keyword" : "domain",
        confidence: story.evolutionRoleConfidence,
        evidence,
      };
      return candidate.role;
    }
  }

  if (story.sourceContentDomain === "business" && story.sectionDomain === "business") {
    story.evolutionRoleConfidence = 0.55;
    story.resolverDiagnostics = {
      roleSource: "heuristic",
      angleSource: "domain",
      confidence: story.evolutionRoleConfidence,
      evidence: ["business source and business section"],
    };
    return "background_context";
  }

  const hasPrior = priorStories.length > 0;
  story.evolutionRoleConfidence = hasPrior ? 0.40 : 0.65;
  story.resolverDiagnostics = {
    roleSource: "heuristic",
    angleSource: "fallback",
    confidence: story.evolutionRoleConfidence,
    evidence: hasPrior ? ["no new role signal after prior reports"] : [`first ${tier} report in cluster`],
  };

  return hasPrior ? "corroboration" : "first_report";
}

/**
 * Assigns temporal tier, role, and confidence fields for a cluster before
 * downstream tree building. Inputs are parent cluster stories; output is a new array.
 */
export function enrichClusterEvolution(
  parent: InsightParent,
  clusterStories: InsightStory[],
  cfg: InsightConfig
): InsightStory[] {
  const anchor = computeEventAnchor(parent, cfg.MAX_STORY_AGE_HOURS);
  const sortedByTime = [...clusterStories].sort((a, b) => a.publishedAt - b.publishedAt);

  for (const story of sortedByTime) {
    story.temporalTier = computeTemporalTier(story.publishedAt, anchor);
    story.temporalTierConfidence = 0.9;
    const priorStories = sortedByTime.filter(prior => prior.publishedAt < story.publishedAt);
    story.evolutionRole = inferEvolutionRole(story, story.temporalTier, priorStories);
  }

  return sortedByTime;
}

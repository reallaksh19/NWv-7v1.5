import { InformationDelta, InsightStory } from "../types";

function normalized(values: string[]): Set<string> {
  return new Set(
    values
      .map(value => value.toLowerCase().trim())
      .filter(value => value.length > 0)
  );
}

function collectEntities(story: InsightStory): string[] {
  return [
    ...(story.entities?.people || []),
    ...(story.entities?.orgs || []),
    ...(story.entities?.places || []),
    ...(story.entities?.products || []),
    ...(story.entities?.symbols || []),
  ];
}

function unseenValues(values: string[], baselineValues: Set<string>): string[] {
  return values.filter(value => !baselineValues.has(value.toLowerCase().trim()));
}

function textTokens(story: InsightStory): string[] {
  const text = `${story.title || ""} ${story.summary || ""}`.toLowerCase();
  return text
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(token => token.length >= 5)
    .filter(token => !/^(about|after|before|their|there|which|could|would|should|while|where|being|under|over)$/.test(token));
}

/**
 * Extracts incremental information carried by one story against older cluster
 * stories. Inputs are a candidate plus chronological baseline; output is a
 * bounded delta score and the concrete atoms that made it new.
 */
export function extractInformationDelta(
  story: InsightStory,
  baseline: InsightStory[]
): InformationDelta {
  const baselineNumbers = normalized(baseline.flatMap(item => item.numbers || []));
  const baselineEntities = normalized(baseline.flatMap(collectEntities));
  const baselineKeywords = normalized([
    ...baseline.flatMap(item => item.keywords || []),
    ...baseline.flatMap(textTokens),
  ]);

  const newNumbers = unseenValues(story.numbers || [], baselineNumbers);
  const newEntities = unseenValues(collectEntities(story), baselineEntities);
  const newKeywords = unseenValues([...(story.keywords || []), ...textTokens(story)], baselineKeywords);

  if (baseline.length === 0) {
    return {
      deltaScore: 1,
      newNumbers,
      newEntities,
      newKeywords: newKeywords.slice(0, 12),
      repeatedFactPenalty: 0,
    };
  }

  const numberScore = Math.min(1, newNumbers.length / 3);
  const entityScore = Math.min(1, newEntities.length / 5);
  const keywordScore = Math.min(1, newKeywords.length / 8);
  const roleScore = story.evolutionRole && !baseline.some(item => item.evolutionRole === story.evolutionRole)
    ? 1
    : 0;
  const domainScore = story.sourceContentDomain && !baseline.some(item => item.sourceContentDomain === story.sourceContentDomain)
    ? 1
    : 0;

  const rawScore =
    0.36 * numberScore +
    0.30 * entityScore +
    0.18 * keywordScore +
    0.10 * roleScore +
    0.06 * domainScore;
  const deltaScore = Math.max(0, Math.min(1, rawScore));

  return {
    deltaScore: Math.round(deltaScore * 1000) / 1000,
    newNumbers,
    newEntities,
    newKeywords: newKeywords.slice(0, 12),
    repeatedFactPenalty: Math.round(Math.min(0.25, 1 - deltaScore) * 1000) / 1000,
  };
}

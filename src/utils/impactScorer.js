import { matchesEntertainmentGuard, severityHits, geoScaleScore, DEFAULT_RANKING_POLICY } from '../config/rankingPolicy.js';

/**
 * Calculates impact score based on:
 * 1. Geographic scale (global > national > regional > local) — driven by ranking_policy.json
 * 2. Population magnitude (millions > thousands > individuals)
 * 3. High-impact keywords with optional severity context gate (RC-1 fix)
 */
export function calculateImpactScore(title, description, settings) {
    const text = `${title} ${description}`;

    // 1. Scale Detection — uses policy geoScale lexicon (RC-4 fix)
    const scaleScore = geoScaleScore(text);

    // 2. Magnitude Detection (Population/Financial Impact)
    let magnitudeScore = 1.0;
    const textLow = text.toLowerCase();

    if (/\b(billions?|trillions?)\b/.test(textLow)) {
        magnitudeScore = 1.5;
    } else if (/\b(millions?|lakhs?|crores?)\b/.test(textLow)) {
        magnitudeScore = 1.3;
    } else if (/\b(thousands?|hundreds of thousands?)\b/.test(textLow)) {
        magnitudeScore = 1.1;
    }

    // 3. High-Impact Keyword Detection — severity-gated to prevent franchise/entertainment false positives (RC-1 fix)
    let keywordMultiplier = 1.0;
    const decisions = [];
    const guarded = matchesEntertainmentGuard(text);

    for (const entry of DEFAULT_RANKING_POLICY.highImpactKeywords) {
        const term = (entry.term || '').toLowerCase();
        if (!term) continue;
        const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (!re.test(text)) continue;
        if (entry.requireSeverityContext) {
            if (guarded) {
                decisions.push(`high-impact '${term}' suppressed: entertainment guard`);
                continue;
            }
            if (severityHits(text).length === 0) {
                decisions.push(`high-impact '${term}' suppressed: no severity context`);
                continue;
            }
        }
        keywordMultiplier = settings?.rankingWeights?.impact?.highImpactBoost || 2.5;
        decisions.push(`high-impact keyword '${term}' x${keywordMultiplier}`);
        break;
    }

    // Also check legacy settings.highImpactKeywords for backwards compatibility
    if (keywordMultiplier === 1.0 && settings && Array.isArray(settings.highImpactKeywords)) {
        const hasMatch = settings.highImpactKeywords.some(keyword => {
            if (!keyword) return false;
            const re = new RegExp(`\\b${String(keyword).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
            return re.test(textLow);
        });
        if (hasMatch) {
            keywordMultiplier = settings.rankingWeights?.impact?.highImpactBoost || 2.5;
            decisions.push(`legacy high-impact keyword match x${keywordMultiplier}`);
        }
    }

    calculateImpactScore._lastDecisions = decisions;
    return scaleScore * magnitudeScore * keywordMultiplier;
}

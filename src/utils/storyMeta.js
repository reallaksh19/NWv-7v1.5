const SOURCE_OVERRIDES = [
    { match: /al jazeera/i, label: 'Al Jazeera' },
    { match: /the hollywood reporter/i, label: 'Hollywood' },
    { match: /hollywood reporter/i, label: 'Hollywood' },
    { match: /times of india|\btoi\b/i, label: 'TOI' },
    { match: /the hindu/i, label: 'Hindu' },
    { match: /india today/i, label: 'India Today' },
    { match: /oman observer/i, label: 'Observer' },
    { match: /moneycontrol/i, label: 'Moneycontrol' },
    { match: /reuters/i, label: 'Reuters' },
    { match: /bbc/i, label: 'BBC' },
    { match: /ndtv/i, label: 'NDTV' },
    { match: /variety/i, label: 'Variety' },
    { match: /deadline/i, label: 'Deadline' },
    { match: /behindwoods/i, label: 'Behindwoods' },
    { match: /filmibeat/i, label: 'Filmibeat' },
    { match: /hindustan times/i, label: 'HT' },
    { match: /the news minute/i, label: 'TNM' }
];

export function shortenSourceLabel(source) {
    if (!source) return 'Source';

    const cleaned = String(source)
        .replace(/\s*[-\u2013\u2014].*$/, '')
        .replace(/\s*-\s*breaking news.*$/i, '')
        .trim();

    for (const override of SOURCE_OVERRIDES) {
        if (override.match.test(cleaned)) {
            return override.label;
        }
    }

    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length <= 2) {
        return cleaned;
    }

    return words.slice(0, 2).join(' ');
}

export function getStoryUrl(item) {
    return item?.url || item?.link || item?.sourceUrl || item?.sourceLink || '';
}

export function buildStoryInfoText(item, { includeScoreBreakdown = false } = {}) {
    const storyUrl = getStoryUrl(item);
    const lines = [];

    if (item?.source) {
        lines.push(`Source: ${shortenSourceLabel(item.source)}`);
    }

    if (storyUrl) {
        lines.push(`Source Link: ${storyUrl}`);
    }

    if (item?.headline || item?.title) {
        lines.push(`Story: ${item.headline || item.title}`);
    }

    if (includeScoreBreakdown && item?._scoreBreakdown) {
        const b = item._scoreBreakdown;
        const f = (x, d = 2) => Number(x ?? 0).toFixed(d);
        lines.push('');
        lines.push(`Ranking Score: ${f(item.impactScore)}`);
        lines.push(`Formula: (freshness + keyword + sentiment) x sourceMult x [impact*severity*novelty*visual*humanInterest] x section x breaking x live x seen`);
        lines.push(`Freshness: ${f(b.freshness)}`);
        lines.push(`Source Tier: ${f(b.sourceScore)} (cat ${f(b.categoryWeight)})`);
        lines.push(`Impact/Geo: ${f(b.impact)}`);
        lines.push(`Severity: ${f(b.severity, 2)}`);
        lines.push(`Novelty: ${f(b.novelty)}  Visual: ${f(b.visual)}  HumanInterest: ${f(b.humanInterest)}`);
        lines.push(`Section x: ${f(b.sectionPriority)}  Breaking x: ${f(b.breakingBoost)}  Live x: ${f(b.liveBoost)}  Seen x: ${f(b.seenPenalty)}`);
        if (Array.isArray(b.decisions) && b.decisions.length) {
            lines.push('');
            lines.push('Why this rank:');
            b.decisions.forEach((d) => lines.push(`• ${d}`));
        }
    }

    return lines.join('\n');
}

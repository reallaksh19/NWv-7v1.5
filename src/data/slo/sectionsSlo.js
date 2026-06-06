function ratio(part, total) {
  const numericTotal = Number(total);

  if (!Number.isFinite(numericTotal) || numericTotal <= 0) return 0;

  return Number(part || 0) / numericTotal;
}

function maxSourceDominance(sourceCounts = {}) {
  const counts = Object.values(sourceCounts)
    .map(Number)
    .filter(Number.isFinite);

  const total = counts.reduce((sum, n) => sum + n, 0);

  if (total <= 0 || counts.length === 0) {
    return {
      topCount: 0,
      total,
      ratio: 0,
    };
  }

  const topCount = Math.max(...counts);

  return {
    topCount,
    total,
    ratio: topCount / total,
  };
}

export function evaluateSectionsSlo(input = {}) {
  const data = input?.data || input || {};

  const frontPage = Array.isArray(data.frontPage) ? data.frontPage : [];
  const sections = data.sections && typeof data.sections === 'object' ? data.sections : {};

  const sectionCounts = data.sectionCounts && typeof data.sectionCounts === 'object'
    ? data.sectionCounts
    : Object.fromEntries(
        Object.entries(sections).map(([section, items]) => [
          section,
          Array.isArray(items) ? items.length : 0,
        ])
      );

  const failedSections = Array.isArray(data.failedSections) ? data.failedSections : [];
  const duplicateHints = Array.isArray(data.duplicateHints) ? data.duplicateHints : [];
  const sourceCounts = data.sourceCounts || {};
  const dominance = maxSourceDominance(sourceCounts);

  const totalSectionItems = Object.values(sectionCounts)
    .reduce((sum, count) => sum + Number(count || 0), 0);

  const emptySections = Object.entries(sectionCounts)
    .filter(([, count]) => Number(count || 0) === 0)
    .map(([section]) => section);

  const reasons = [];
  const warnings = [];

  if (frontPage.length === 0 && totalSectionItems === 0) {
    reasons.push('sections_empty');
  }

  if (frontPage.length > 0 && frontPage.length < 5) {
    warnings.push('sections_front_page_low_count');
  }

  if (Object.keys(sectionCounts).length < 3 && totalSectionItems > 0) {
    warnings.push('sections_low_section_diversity');
  }

  if (failedSections.length > 0) {
    warnings.push(`sections_failed:${failedSections.length}`);
  }

  if (emptySections.length > 0) {
    warnings.push(`sections_empty_buckets:${emptySections.join(',')}`);
  }

  if (duplicateHints.length > Math.max(5, totalSectionItems * 0.2)) {
    warnings.push('sections_duplicate_pressure_high');
  }

  if (dominance.ratio > 0.45) {
    warnings.push('sections_source_dominance_high');
  }

  return {
    id: 'sectionsSlo',
    required: true,
    passed: reasons.length === 0,
    penalty: 40,
    score: reasons.length === 0
      ? Math.max(60, 100 - warnings.length * 5)
      : 0,
    reasons,
    warnings,
    metrics: {
      frontPageCount: frontPage.length,
      sectionCount: Object.keys(sectionCounts).length,
      totalSectionItems,
      failedSectionCount: failedSections.length,
      emptySectionCount: emptySections.length,
      duplicateHintCount: duplicateHints.length,
      sourceDominanceRatio: Number(dominance.ratio.toFixed(3)),
      sourceDominancePercent: Number((dominance.ratio * 100).toFixed(1)),
      liveCoverageRatio: ratio(frontPage.length, totalSectionItems),
    },
  };
}

export const __sectionsSloInternalsForTest = {
  maxSourceDominance,
};

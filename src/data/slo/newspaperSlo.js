export function evaluateNewspaperSlo(input = {}) {
  const data = input?.data || input || {};

  const frontPage = Array.isArray(data.frontPage) ? data.frontPage : [];
  const topStories = Array.isArray(data.topStories) ? data.topStories : [];
  const sections = data.sections && typeof data.sections === 'object' ? data.sections : {};
  const layoutGroups = data.layoutGroups && typeof data.layoutGroups === 'object' ? data.layoutGroups : {};
  const sourceDiversity = data.sourceDiversity || {};

  const sectionItemCount = Object.values(sections).reduce((sum, items) => {
    return sum + (Array.isArray(items) ? items.length : 0);
  }, 0);

  const layoutItems = Object.values(layoutGroups).flat();
  const layoutItemCount = layoutItems.length;
  const layoutGroupCount = Object.keys(layoutGroups).length;

  const sourceDominanceRatio = Number(sourceDiversity?.topSourceRatio || 0);

  const reasons = [];
  const warnings = [];

  if (frontPage.length === 0) {
    reasons.push('newspaper_front_page_empty');
  }

  if (frontPage.length > 0 && topStories.length === 0) {
    warnings.push('newspaper_top_stories_empty');
  }

  if (layoutGroupCount > 0 && layoutItemCount === 0) {
    warnings.push('newspaper_layout_groups_empty');
  }

  if (layoutGroupCount < 3 && sectionItemCount > 0) {
    warnings.push('newspaper_layout_diversity_low');
  }

  if (sourceDominanceRatio > 0.4) {
    warnings.push('newspaper_source_dominance_high');
  }

  return {
    id: 'newspaperSlo',
    required: false,
    passed: reasons.length === 0,
    penalty: 20,
    score: reasons.length === 0
      ? Math.max(55, 100 - warnings.length * 5)
      : 0,
    reasons,
    warnings,
    metrics: {
      frontPageCount: frontPage.length,
      topStoryCount: topStories.length,
      sectionItemCount,
      layoutItemCount,
      layoutGroupCount,
      sourceDominanceRatio,
    },
  };
}

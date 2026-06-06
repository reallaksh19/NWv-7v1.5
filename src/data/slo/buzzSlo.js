function countBucketItems(bucketMap = {}) {
  if (!bucketMap || typeof bucketMap !== 'object') return 0;

  return Object.values(bucketMap).reduce((sum, items) => {
    return sum + (Array.isArray(items) ? items.length : 0);
  }, 0);
}

function getPresentBuckets(bucketMap = {}) {
  if (!bucketMap || typeof bucketMap !== 'object') return [];

  return Object.entries(bucketMap)
    .filter(([, items]) => Array.isArray(items) && items.length > 0)
    .map(([name]) => name);
}

export function evaluateBuzzSlo(input = {}) {
  const data = input?.data || input || {};

  const entertainment = data.entertainment || {};
  const socialTrends = data.socialTrends || {};
  const techCards = Array.isArray(data.techCards) ? data.techCards : [];
  const aiCards = Array.isArray(data.aiCards) ? data.aiCards : [];
  const sourceDominance = data.raw?.sourceDominance || {};

  const entertainmentCount = countBucketItems(entertainment);
  const socialCount = countBucketItems(socialTrends);
  const techCount = techCards.length;
  const aiCount = aiCards.length;
  const total = entertainmentCount + socialCount + techCount + aiCount;

  const entertainmentBuckets = getPresentBuckets(entertainment);
  const socialBuckets = getPresentBuckets(socialTrends);

  const presentSurfaceCount = [
    entertainmentCount > 0,
    socialCount > 0,
    techCount + aiCount > 0,
  ].filter(Boolean).length;

  const reasons = [];
  const warnings = [];

  if (total === 0) {
    reasons.push('buzz_empty');
  }

  if (entertainmentCount === 0) {
    warnings.push('buzz_entertainment_empty');
  }

  if (socialCount === 0) {
    warnings.push('buzz_social_empty');
  }

  if (techCount === 0 && aiCount === 0) {
    warnings.push('buzz_tech_empty');
  }

  if (presentSurfaceCount < 2 && total > 0) {
    warnings.push('buzz_surface_diversity_low');
  }

  if (entertainmentBuckets.length < 2 && entertainmentCount > 0) {
    warnings.push('buzz_entertainment_bucket_diversity_low');
  }

  if (socialBuckets.length < 2 && socialCount > 0) {
    warnings.push('buzz_social_bucket_diversity_low');
  }

  if (Number(sourceDominance.ratio || 0) > 0.45) {
    warnings.push('buzz_source_dominance_high');
  }

  return {
    id: 'buzzSlo',
    required: false,
    passed: reasons.length === 0,
    penalty: 25,
    score: reasons.length === 0
      ? Math.max(55, 100 - warnings.length * 5)
      : 0,
    reasons,
    warnings,
    metrics: {
      total,
      entertainmentCount,
      socialCount,
      techCount,
      aiCount,
      entertainmentBucketCount: entertainmentBuckets.length,
      socialBucketCount: socialBuckets.length,
      presentSurfaceCount,
      sourceDominanceRatio: Number(sourceDominance.ratio || 0),
    },
  };
}

export const __buzzSloInternalsForTest = {
  countBucketItems,
  getPresentBuckets,
};

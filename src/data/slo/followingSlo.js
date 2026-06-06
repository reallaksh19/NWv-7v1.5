export function evaluateFollowingSlo(input = {}) {
  const data = input?.data || input || {};

  const followedTopics = Array.isArray(data.followedTopics) ? data.followedTopics : [];
  const topicNews = data.topicNews && typeof data.topicNews === 'object' ? data.topicNews : {};
  const failedTopics = Array.isArray(data.failedTopics) ? data.failedTopics : [];
  const duplicateTopics = Array.isArray(data.duplicateTopics) ? data.duplicateTopics : [];

  const articleCount = Object.values(topicNews).reduce((sum, articles) => {
    return sum + (Array.isArray(articles) ? articles.length : 0);
  }, 0);

  const reasons = [];
  const warnings = [];

  if (followedTopics.length === 0) {
    warnings.push('following_empty_list');

    return {
      id: 'followingSlo',
      required: false,
      passed: true,
      penalty: 10,
      score: 85,
      reasons,
      warnings,
      metrics: {
        followedTopicCount: 0,
        failedTopicCount: 0,
        articleCount: 0,
        duplicateTopicCount: duplicateTopics.length,
      },
    };
  }

  if (failedTopics.length === followedTopics.length) {
    reasons.push('following_all_topics_failed');
  }

  if (followedTopics.length > 0 && articleCount === 0) {
    reasons.push('following_no_articles_returned');
  }

  if (failedTopics.length > 0 && failedTopics.length < followedTopics.length) {
    warnings.push(`following_some_topics_failed:${failedTopics.length}`);
  }

  if (duplicateTopics.length > 0) {
    warnings.push(`following_duplicate_topics:${duplicateTopics.length}`);
  }

  return {
    id: 'followingSlo',
    required: false,
    passed: reasons.length === 0,
    penalty: 15,
    score: reasons.length === 0
      ? Math.max(55, 100 - warnings.length * 5)
      : 0,
    reasons,
    warnings,
    metrics: {
      followedTopicCount: followedTopics.length,
      failedTopicCount: failedTopics.length,
      articleCount,
      duplicateTopicCount: duplicateTopics.length,
    },
  };
}

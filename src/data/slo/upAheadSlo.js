function countArray(value) {
  return Array.isArray(value) ? value.length : 0;
}

function getItemDateMs(item) {
  const value =
    item?.eventDate ||
    item?.eventDateKey ||
    item?.date ||
    item?.releaseDate ||
    item?.planDate ||
    item?.expiryAt;

  if (!value) return null;

  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function countExpired(items = [], now = Date.now()) {
  return (Array.isArray(items) ? items : []).filter(item => {
    const time = getItemDateMs(item);
    return time != null && time < now - 24 * 60 * 60 * 1000;
  }).length;
}

export function evaluateUpAheadSlo(input = {}) {
  const data = input?.data || input || {};
  const now = Number(input.now || Date.now());

  const planCount = countArray(data.plan);
  const offerCount = countArray(data.offers);
  const releaseCount = countArray(data.releases);
  const eventCount = countArray(data.events);
  const alertCount = countArray(data.alerts);
  const weatherAlertCount = countArray(data.weatherAlerts);
  const combinedAlertCount = countArray(data.combinedAlerts);
  const festivalCount = countArray(data.festivals);
  const civicCount = countArray(data.civics);

  const expiredOfferCount = countExpired(data.offers, now);
  const expiredEventCount = countExpired(data.events, now);
  const expiredReleaseCount = countExpired(data.releases, now);
  const expiredFestivalCount = countExpired(data.festivals, now);

  const totalVisible =
    planCount +
    offerCount +
    releaseCount +
    eventCount +
    combinedAlertCount +
    festivalCount +
    civicCount;

  const totalExpired =
    expiredOfferCount +
    expiredEventCount +
    expiredReleaseCount +
    expiredFestivalCount;

  const hasBriefing = Boolean(data.briefing);
  const hasEvidence = Boolean(data.evidence);

  const reasons = [];
  const warnings = [];

  if (totalVisible === 0) {
    reasons.push('upAhead_empty');
  }

  if (totalVisible > 0 && totalExpired >= totalVisible) {
    reasons.push('upAhead_all_visible_content_expired');
  }

  if (!hasBriefing) {
    warnings.push('upAhead_briefing_missing');
  }

  if (!hasEvidence) {
    warnings.push('upAhead_evidence_missing');
  }

  if (combinedAlertCount > 0 && weatherAlertCount === 0 && alertCount === 0 && civicCount === 0) {
    warnings.push('upAhead_combined_alert_shape_inconsistent');
  }

  if (offerCount > 0 && !data.sourceMode) {
    warnings.push('upAhead_sourceMode_missing');
  }

  if (expiredOfferCount > 0) {
    warnings.push(`upAhead_expired_offers:${expiredOfferCount}`);
  }

  if (expiredEventCount > 0) {
    warnings.push(`upAhead_expired_events:${expiredEventCount}`);
  }

  if (expiredReleaseCount > 0) {
    warnings.push(`upAhead_expired_releases:${expiredReleaseCount}`);
  }

  if (expiredFestivalCount > 0) {
    warnings.push(`upAhead_expired_festivals:${expiredFestivalCount}`);
  }

  return {
    id: 'upAheadSlo',
    required: false,
    passed: reasons.length === 0,
    penalty: 25,
    score: reasons.length === 0
      ? Math.max(55, 100 - warnings.length * 5)
      : 0,
    reasons,
    warnings,
    metrics: {
      totalVisible,
      totalExpired,
      planCount,
      offerCount,
      releaseCount,
      eventCount,
      alertCount,
      weatherAlertCount,
      combinedAlertCount,
      festivalCount,
      civicCount,
      expiredOfferCount,
      expiredEventCount,
      expiredReleaseCount,
      expiredFestivalCount,
      hasBriefing,
      hasEvidence,
    },
  };
}

export const __upAheadSloInternalsForTest = {
  getItemDateMs,
  countExpired,
};

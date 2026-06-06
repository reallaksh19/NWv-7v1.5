import fs from 'node:fs';
import path from 'node:path';

const NEWSDATA_DIR = path.resolve('public/newsdata');
const OUTPUT_PATH = path.join(NEWSDATA_DIR, 'quality_dashboard.json');
const HISTORY_PATH = path.join(NEWSDATA_DIR, 'quality_dashboard_history.json');

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Tolerant story count extraction — reads multiple field paths in order.
 * The insight quality report schema has evolved; this handles all known variants.
 */
function extractStoryCount(report) {
  if (!report) return 0;

  return toNumber(
    report.storyCount ??
    report.stories ??
    report.totalStories ??
    report.latest?.storyCount ??
    report.latest?.totalStories ??
    report.summary?.storyCount ??
    report.summary?.totalStories ??
    report.metrics?.storyCount ??
    report.metrics?.totalStories ??
    report.quality?.storyCount ??
    report.quality?.totalStories ??
    0
  );
}

function extractSourceGroupCount(report) {
  if (!report) return 0;

  return toNumber(
    report.sourceGroupCount ??
    report.sourceGroups ??
    report.latest?.sourceGroupCount ??
    report.latest?.sourceGroups ??
    report.summary?.sourceGroupCount ??
    report.summary?.sourceGroups ??
    report.metrics?.sourceGroupCount ??
    report.metrics?.sourceGroups ??
    0
  );
}

function main() {
  const insightQuality = readJson(path.join(NEWSDATA_DIR, 'insight_quality_report.json'), {});
  const sectionsQuality = readJson(path.join(NEWSDATA_DIR, 'sections_quality_report.json'), {});
  const sourcePolicy = readJson(path.join(NEWSDATA_DIR, 'source_policy_report.json'), {});
  const sectionSourcePolicy = readJson(path.join(NEWSDATA_DIR, 'section_source_policy_report.json'), {});
  const realInsightQuality = readJson(path.join(NEWSDATA_DIR, 'real_insight_quality_report.json'), {});

  // Use the richer real-insight-quality report when it has more data
  const primaryReport = extractStoryCount(realInsightQuality) > extractStoryCount(insightQuality)
    ? realInsightQuality
    : insightQuality;

  const reportStoryCount = extractStoryCount(primaryReport);
  const reportSourceGroupCount = extractSourceGroupCount(primaryReport);

  const generatedAt = Date.now();
  const latest = {
    insightGrade: primaryReport.grade || insightQuality.grade || realInsightQuality.grade || null,
    insightScore: toNumber(primaryReport.score ?? insightQuality.score ?? realInsightQuality.score, 0),
    totalStories: reportStoryCount,
    usableStories36h: toNumber(
      primaryReport.usable36hStoryCount ??
      primaryReport.usable24hStoryCount ??
      primaryReport.usableStories ??
      0
    ),
    sourceGroups: reportSourceGroupCount,
    angleHintCoverage: toNumber(primaryReport.angleHintCoverage ?? insightQuality.angleHintCoverage, 0),
    sectionsTotalStories: toNumber(sectionsQuality.totalStories, 0),
    sectionsCount: toNumber(sectionsQuality.sectionCount, 0),
  };

  // ── False-zero guard ─────────────────────────────────────────────────────────
  // If the insight report says there are stories but the dashboard would record zero,
  // that is a data pipeline bug. Refuse to write the output.
  if (reportStoryCount > 0 && latest.totalStories === 0) {
    console.error(
      '[generate_quality_dashboard] FATAL: report storyCount is',
      reportStoryCount,
      'but computed dashboard totalStories is 0. Refusing to write false-zero dashboard.'
    );
    process.exit(1);
  }

  // ── Downgrade guard ──────────────────────────────────────────────────────────
  // Never overwrite a nonzero dashboard with zero when the source report is also nonzero.
  const existingDashboard = readJson(OUTPUT_PATH, null);
  const existingTotalStories = toNumber(
    existingDashboard?.latest?.totalStories ?? existingDashboard?.totalStories,
    0
  );

  if (
    existingTotalStories > 0 &&
    latest.totalStories === 0 &&
    reportStoryCount === 0
  ) {
    // Only block if source report is ALSO zero (which could be a transient read failure).
    // If source has stories but dashboard would be zero, the false-zero guard above already exits.
    console.warn(
      '[generate_quality_dashboard] WARN: existing dashboard has',
      existingTotalStories,
      'stories but new run would write 0. This may indicate a transient report read failure.',
      'Not writing zero over nonzero.'
    );
    process.exit(1);
  }

  const today = new Date(generatedAt).toISOString().slice(0, 10);
  const history = readJson(HISTORY_PATH, { schemaVersion: 1, days: [] });
  const prunedDays = Array.isArray(history.days) ? history.days.filter(d => d?.date !== today) : [];

  prunedDays.push({
    date: today,
    generatedAt,
    ...latest,
    sourceUptimePercent: toNumber(sourcePolicy.summary?.uptimePercent, 0),
    angleDiversityScore: toNumber(primaryReport.angleDiversityScore ?? insightQuality.angleDiversityScore, 0),
  });

  prunedDays.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const days = prunedDays.slice(-7);

  const avg = (arr, key) => {
    const nums = arr.map(x => Number(x?.[key])).filter(Number.isFinite);
    if (nums.length === 0) return 0;
    return Number((nums.reduce((s, n) => s + n, 0) / nums.length).toFixed(2));
  };

  const dashboard = {
    schemaVersion: 1,
    generatedAt,
    windowDays: 7,
    latest,
    sourceHealth: {
      insight: {
        activeFeeds: toNumber(sourcePolicy.summary?.activeFeedCount, 0),
        suppressedFeeds: toNumber(sourcePolicy.summary?.suppressedFeedCount, 0),
        weakFeeds: toNumber(sourcePolicy.summary?.weakFeedCount, 0),
      },
      sections: {
        activeFeeds: toNumber(sectionSourcePolicy.summary?.activeFeedCount, 0),
        weakFeeds: toNumber(sectionSourcePolicy.summary?.weakFeedCount, 0),
      },
    },
    trends: {
      avgInsightScore7d: avg(days, 'insightScore'),
      sourceUptimePercent7d: avg(days, 'sourceUptimePercent'),
      angleDiversity7d: avg(days, 'angleDiversityScore'),
    },
    history: days,
    notes: [
      'This dashboard reflects the best available insight quality report and guards against false-zero output.',
    ],
  };

  fs.mkdirSync(NEWSDATA_DIR, { recursive: true });
  fs.writeFileSync(HISTORY_PATH, JSON.stringify({ schemaVersion: 1, generatedAt, days }, null, 2));
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(dashboard, null, 2));
  console.log(`[generate_quality_dashboard] Wrote ${OUTPUT_PATH} (totalStories: ${latest.totalStories})`);
}

main();

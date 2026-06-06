import {
  makeEnvelope,
  ENVELOPE_SOURCES,
  ENVELOPE_FRESHNESS,
} from '../dataEnvelope.js';
import { applyDatasetSlo } from '../slo/applyDatasetSlo.js';
import { fetchSectionNews } from '../../services/rssAggregator.js';
import { composeBalancedFeed } from '../../services/frontPageComposer.js';
import { getSettings } from '../../utils/storage.js';
import { deduplicateAndCluster } from '../../utils/similarity.js';

const DEFAULT_SECTIONS = [
  'world',
  'india',
  'chennai',
  'trichy',
  'local',
  'social',
  'entertainment',
  'business',
  'technology',
];

const DEFAULT_MAX_SECTIONS = 6;

function safeGetSettings() {
  try {
    return getSettings?.() || {};
  } catch (error) {
    console.warn('[sectionsDataset] getSettings failed', error);
    return {};
  }
}

function getEnabledSections(settings) {
  return DEFAULT_SECTIONS.filter(section => settings?.sections?.[section]?.enabled !== false);
}

function getRequestedSections(settings, options = {}, diagnostics = []) {
  const rawSections = Array.isArray(options.sections) && options.sections.length > 0
    ? options.sections
    : getEnabledSections(settings);

  const maxSections = Math.max(1, Number(options.maxSections || DEFAULT_MAX_SECTIONS));
  const boundedSections = rawSections.slice(0, maxSections);

  if (rawSections.length > boundedSections.length) {
    diagnostics.push({
      event: 'sectionsDataset.section_limit_applied',
      severity: 'info',
      message: `Bounded section loading from ${rawSections.length} to ${boundedSections.length}`,
      details: {
        requestedCount: rawSections.length,
        maxSections,
        requestedSections: rawSections,
        loadedSections: boundedSections,
      },
    });
  }

  return boundedSections;
}

function getSectionLimit(settings, section) {
  return Number(settings?.sections?.[section]?.count || 10) + 5;
}

function countSources(items = []) {
  const counts = {};

  items.forEach(item => {
    const source = item?.source || 'Unknown';
    counts[source] = (counts[source] || 0) + 1;
  });

  return counts;
}

function getDuplicateHints(items = []) {
  const seen = new Map();
  const hints = [];

  items.forEach(item => {
    const key = String(item?.title || item?.headline || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

    if (!key) return;

    if (seen.has(key)) {
      hints.push({
        title: item.title || item.headline,
        firstId: seen.get(key),
        duplicateId: item.id,
      });
      return;
    }

    seen.set(key, item.id);
  });

  return hints.slice(0, 25);
}

function normalizeSectionBuckets(items, fallbackSections) {
  const buckets = {};

  fallbackSections.forEach(section => {
    buckets[section] = [];
  });

  items.forEach(item => {
    const section = item?.section || 'uncategorized';

    if (!buckets[section]) buckets[section] = [];
    buckets[section].push(item);
  });

  Object.keys(buckets).forEach(section => {
    buckets[section].sort((a, b) => Number(b?.impactScore || 0) - Number(a?.impactScore || 0));
  });

  return buckets;
}

export async function load(options = {}) {
  const settings = safeGetSettings();
  const diagnostics = [];
  const requestedSections = getRequestedSections(settings, options, diagnostics);

  const results = await Promise.allSettled(
    requestedSections.map(async section => {
      const count = getSectionLimit(settings, section);
      const items = await fetchSectionNews(section, count, settings.newsSources);

      return {
        section,
        items: Array.isArray(items) ? items : [],
        metadata: {
          prefetched: items?.prefetched === true,
          prefetchSourceSection: items?.prefetchSourceSection || null,
          sectionQuality: items?.sectionQuality || null,
          snapshotRuntimeSummary: items?.snapshotRuntimeSummary || null,
          health: items?.health || null,
          isSingleSource: items?.isSingleSource || false,
        },
      };
    })
  );

  const raw = {};
  const sectionHealth = {};
  const failedSections = [];

  results.forEach((result, index) => {
    const section = requestedSections[index];

    if (result.status === 'fulfilled') {
      raw[section] = result.value.items;
      sectionHealth[section] = result.value.metadata;

      diagnostics.push({
        event: 'sectionsDataset.section_loaded',
        severity: result.value.items.length > 0 ? 'info' : 'warn',
        message: `${section}: ${result.value.items.length} item(s)`,
        details: result.value.metadata,
      });
      return;
    }

    raw[section] = [];
    failedSections.push(section);

    diagnostics.push({
      event: 'sectionsDataset.section_failed',
      severity: 'error',
      message: result.reason?.message || String(result.reason),
      details: { section },
    });
  });

  const allFetched = Object.values(raw).flat();

  const deduplicated = deduplicateAndCluster(
    allFetched,
    settings.storyDeduplication
  );

  const sections = normalizeSectionBuckets(deduplicated, requestedSections);

  const frontPage = composeBalancedFeed(
    deduplicated,
    options.frontPageLimit || 20,
    settings.maxTopicPercent || 40,
    settings.maxGeoPercent || 30
  );

  const sectionCounts = Object.fromEntries(
    Object.entries(sections).map(([section, items]) => [section, items.length])
  );

  const sourceCounts = countSources(deduplicated);
  const duplicateHints = getDuplicateHints(allFetched);
  const ok = frontPage.length > 0 || deduplicated.length > 0;

  const envelope = makeEnvelope({
    ok,
    datasetId: 'sections',
    data: {
      sections,
      frontPage,
      sectionCounts,
      sourceCounts,
      duplicateHints,
      failedSections,
      sectionHealth,
      requestedSections,
      raw,
    },
    source: Object.values(sectionHealth).some(meta => meta?.prefetched)
      ? ENVELOPE_SOURCES.SNAPSHOT
      : ENVELOPE_SOURCES.LIVE,
    freshness: ok ? ENVELOPE_FRESHNESS.FRESH : ENVELOPE_FRESHNESS.EMPTY,
    error: ok ? null : 'sections unavailable',
    validation: {
      passed: ok,
      errors: ok ? [] : ['sections_unavailable'],
      warnings: [
        ...failedSections.map(section => `section_failed:${section}`),
        ...Object.entries(sectionCounts)
          .filter(([, count]) => count === 0)
          .map(([section]) => `section_empty:${section}`),
      ],
    },
    diagnostics,
  });

  return applyDatasetSlo(envelope);
}

export const __sectionsDatasetInternalsForTest = {
  DEFAULT_SECTIONS,
  DEFAULT_MAX_SECTIONS,
  countSources,
  getDuplicateHints,
  normalizeSectionBuckets,
  getRequestedSections,
};

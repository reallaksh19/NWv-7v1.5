import {
  makeEnvelope,
  ENVELOPE_SOURCES,
  ENVELOPE_FRESHNESS,
} from '../dataEnvelope.js';
import { applyDatasetSlo } from '../slo/applyDatasetSlo.js';
import { load as loadSectionsDataset } from './sectionsDataset.js';

function getLayoutGroups(sections = {}) {
  return {
    lead: [
      ...(sections.world || []),
      ...(sections.india || []),
    ].slice(0, 8),
    local: [
      ...(sections.chennai || []),
      ...(sections.trichy || []),
      ...(sections.local || []),
    ].slice(0, 8),
    business: (sections.business || []).slice(0, 6),
    technology: (sections.technology || []).slice(0, 6),
    culture: [
      ...(sections.entertainment || []),
      ...(sections.social || []),
    ].slice(0, 8),
  };
}

function getSourceDiversity(items = []) {
  const counts = {};

  items.forEach(item => {
    const source = item?.source || 'Unknown';
    counts[source] = (counts[source] || 0) + 1;
  });

  const total = items.length;
  const [topSource, topCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || [null, 0];

  return {
    total,
    sourceCounts: counts,
    topSource,
    topSourceRatio: total ? topCount / total : 0,
  };
}

export async function load() {
  const sectionsEnv = await loadSectionsDataset({
    frontPageLimit: 40,
    maxSections: 6,
  });

  const sections = sectionsEnv.data?.sections || {};
  const frontPage = sectionsEnv.data?.frontPage || [];
  const topStories = frontPage.slice(0, 10);
  const layoutGroups = getLayoutGroups(sections);
  const sourceDiversity = getSourceDiversity(frontPage);
  const ok = frontPage.length > 0;

  const envelope = makeEnvelope({
    ok,
    datasetId: 'newspaper',
    data: {
      frontPage,
      topStories,
      sections,
      layoutGroups,
      sourceDiversity,
      raw: sectionsEnv.data,
    },
    source: sectionsEnv.source || ENVELOPE_SOURCES.LIVE,
    freshness: ok ? ENVELOPE_FRESHNESS.FRESH : ENVELOPE_FRESHNESS.EMPTY,
    error: ok ? null : 'newspaper unavailable',
    validation: {
      passed: ok,
      errors: ok ? [] : ['newspaper_unavailable'],
      warnings: [
        ...(sectionsEnv.validation?.warnings || []),
        sourceDiversity.topSourceRatio > 0.4 ? `source_dominance:${sourceDiversity.topSource}` : null,
      ].filter(Boolean),
    },
    diagnostics: [
      ...(sectionsEnv.diagnostics || []),
      {
        event: 'newspaperDataset.loaded',
        severity: ok ? 'info' : 'warn',
        message: `Newspaper dataset built with ${frontPage.length} front-page stories`,
        details: {
          topStories: topStories.length,
          sourceDiversity,
        },
      },
    ],
  });

  return applyDatasetSlo(envelope);
}

export const __newspaperDatasetInternalsForTest = {
  getLayoutGroups,
  getSourceDiversity,
};

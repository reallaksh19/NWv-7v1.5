import { evaluateMarketSlo } from './marketSlo.js';
import { evaluateQualityDashboardSlo } from './qualityDashboardSlo.js';
import { evaluateSourceHealthSlo } from './sourceHealthSlo.js';

import { evaluateSectionsSlo } from './sectionsSlo.js';
import { evaluateBuzzSlo } from './buzzSlo.js';
import { evaluateUpAheadSlo } from './upAheadSlo.js';
import { evaluateNewspaperSlo } from './newspaperSlo.js';
import { evaluatePlannerSlo } from './plannerSlo.js';
import { evaluateFollowingSlo } from './followingSlo.js';
import { evaluateInsightSlo } from './insightSlo.js';
import { evaluateMainSlo } from './mainSlo.js';

export const DATASET_SLO_EVALUATORS = Object.freeze({
  market: evaluateMarketSlo,
  qualityDashboard: evaluateQualityDashboardSlo,
  sourceHealth: evaluateSourceHealthSlo,

  sections: evaluateSectionsSlo,
  buzz: evaluateBuzzSlo,
  upAhead: evaluateUpAheadSlo,
  newspaper: evaluateNewspaperSlo,
  planner: evaluatePlannerSlo,
  following: evaluateFollowingSlo,
  insight: evaluateInsightSlo,
  main: evaluateMainSlo,
});

export function getDatasetSloEvaluator(datasetId) {
  return DATASET_SLO_EVALUATORS[datasetId] || null;
}

export function __getDatasetSloEvaluatorsForTest() {
  return DATASET_SLO_EVALUATORS;
}

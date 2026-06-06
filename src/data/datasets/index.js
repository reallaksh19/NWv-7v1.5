import * as marketDataset from './marketDataset.js';
import * as qualityDashboardDataset from './qualityDashboardDataset.js';
import * as sourceHealthDataset from './sourceHealthDataset.js';
import * as weatherDataset from './weatherDataset.js';

import * as sectionsDataset from './sectionsDataset.js';
import * as buzzDataset from './buzzDataset.js';
import * as upAheadDataset from './upAheadDataset.js';
import * as newspaperDataset from './newspaperDataset.js';
import * as plannerDataset from './plannerDataset.js';
import * as followingDataset from './followingDataset.js';
import * as insightDataset from './insightDataset.js';
import * as mainDataset from './mainDataset.js';

export const DATASET_LOADERS = Object.freeze({
  market: marketDataset,
  weather: weatherDataset,
  qualityDashboard: qualityDashboardDataset,
  sourceHealth: sourceHealthDataset,

  sections: sectionsDataset,
  buzz: buzzDataset,
  upAhead: upAheadDataset,
  newspaper: newspaperDataset,
  planner: plannerDataset,
  following: followingDataset,
  insight: insightDataset,
  main: mainDataset,
});

export function getDatasetLoader(datasetId) {
  return DATASET_LOADERS[datasetId] || null;
}

export function __getDatasetLoadersForTest() {
  return DATASET_LOADERS;
}

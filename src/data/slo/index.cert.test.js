import { describe, expect, it } from 'vitest';
import {
  DATASET_SLO_EVALUATORS,
  getDatasetSloEvaluator,
} from './index.js';

describe('SLO registry', () => {
  it('registers existing Release 3 SLOs and Release 5 SLOs', () => {
    expect(Object.keys(DATASET_SLO_EVALUATORS).sort()).toEqual([
      'buzz',
      'following',
      'insight',
      'main',
      'market',
      'newspaper',
      'planner',
      'qualityDashboard',
      'sections',
      'sourceHealth',
      'upAhead',
    ]);

    expect(getDatasetSloEvaluator('market')).toBe(DATASET_SLO_EVALUATORS.market);
    expect(getDatasetSloEvaluator('qualityDashboard')).toBe(DATASET_SLO_EVALUATORS.qualityDashboard);
    expect(getDatasetSloEvaluator('sourceHealth')).toBe(DATASET_SLO_EVALUATORS.sourceHealth);

    expect(getDatasetSloEvaluator('sections')).toBe(DATASET_SLO_EVALUATORS.sections);
    expect(getDatasetSloEvaluator('buzz')).toBe(DATASET_SLO_EVALUATORS.buzz);
    expect(getDatasetSloEvaluator('upAhead')).toBe(DATASET_SLO_EVALUATORS.upAhead);
    expect(getDatasetSloEvaluator('newspaper')).toBe(DATASET_SLO_EVALUATORS.newspaper);
    expect(getDatasetSloEvaluator('planner')).toBe(DATASET_SLO_EVALUATORS.planner);
    expect(getDatasetSloEvaluator('following')).toBe(DATASET_SLO_EVALUATORS.following);
    expect(getDatasetSloEvaluator('insight')).toBe(DATASET_SLO_EVALUATORS.insight);
    expect(getDatasetSloEvaluator('main')).toBe(DATASET_SLO_EVALUATORS.main);
  });

  it('returns null for unknown SLO evaluator', () => {
    expect(getDatasetSloEvaluator('weather')).toBe(null);
    expect(getDatasetSloEvaluator('missing')).toBe(null);
  });
});

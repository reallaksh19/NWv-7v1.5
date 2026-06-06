import {
  makeEnvelope,
  ENVELOPE_SOURCES,
  ENVELOPE_FRESHNESS,
} from '../dataEnvelope.js';
import { applyDatasetSlo } from '../slo/applyDatasetSlo.js';
import plannerStorage from '../../utils/plannerStorage.js';

// Planner storage is stateful by design; this loader normalizes current storage state.
// Page mutation remains in Release 5F.

function flattenPlan(plan = {}) {
  return Object.entries(plan)
    .flatMap(([date, items]) => (Array.isArray(items) ? items : []).map(item => ({
      ...item,
      planDate: item.planDate || date,
      eventDateKey: item.eventDateKey || date,
    })));
}

function validatePlannerItem(item) {
  const missing = [];

  if (!item?.title) missing.push('title');
  if (!item?.planDate && !item?.eventDateKey && !item?.eventDate) missing.push('date');
  if (!item?.category && !item?.type) missing.push('category');

  return {
    valid: missing.length === 0,
    missing,
  };
}

export async function load() {
  const diagnostics = [
    {
      event: 'plannerDataset.sync_attempted',
      severity: 'info',
      message: 'Planner storage sync attempted before local read',
    },
  ];

  await Promise.allSettled([
    plannerStorage.loadPlanFromApi?.(),
    plannerStorage.loadBlacklistFromApi?.(),
  ]);

  let plan = {};
  let blacklist = new Set();

  try {
    plan = plannerStorage.getPlan?.() || {};
    blacklist = plannerStorage.getBlacklist?.() || new Set();
  } catch (error) {
    const envelope = makeEnvelope({
      ok: false,
      datasetId: 'planner',
      data: {
        plannedItems: [],
        watchlist: [],
        blacklist: [],
        calendarExportableItems: [],
        invalidItems: [],
        raw: { plan: {}, blacklist: [] },
      },
      source: ENVELOPE_SOURCES.FAILED,
      freshness: ENVELOPE_FRESHNESS.UNKNOWN,
      error: error?.message || String(error),
      validation: {
        passed: false,
        errors: ['planner_storage_failed'],
        warnings: [],
      },
      diagnostics: [
        ...diagnostics,
        {
          event: 'plannerDataset.storage_failed',
          severity: 'error',
          message: error?.message || String(error),
        },
      ],
    });

    return applyDatasetSlo(envelope);
  }

  const plannedItems = flattenPlan(plan);
  const blacklistArray = Array.from(blacklist || []);

  const invalidItems = plannedItems
    .map(item => ({
      item,
      validation: validatePlannerItem(item),
    }))
    .filter(entry => !entry.validation.valid);

  const calendarExportableItems = plannedItems.filter(item => validatePlannerItem(item).valid);

  diagnostics.push({
    event: 'plannerDataset.loaded',
    severity: 'info',
    message: `Planner loaded with ${plannedItems.length} item(s)`,
    details: {
      invalidCount: invalidItems.length,
      blacklistCount: blacklistArray.length,
    },
  });

  const envelope = makeEnvelope({
    ok: true,
    datasetId: 'planner',
    data: {
      plannedItems,
      watchlist: [],
      blacklist: blacklistArray,
      calendarExportableItems,
      invalidItems,
      raw: {
        plan,
        blacklist: blacklistArray,
      },
    },
    source: ENVELOPE_SOURCES.CACHE,
    freshness: plannedItems.length > 0 ? ENVELOPE_FRESHNESS.FRESH : ENVELOPE_FRESHNESS.EMPTY,
    validation: {
      passed: true,
      errors: [],
      warnings: invalidItems.length ? [`planner_invalid_items:${invalidItems.length}`] : [],
    },
    diagnostics,
  });

  return applyDatasetSlo(envelope);
}

export const __plannerDatasetInternalsForTest = {
  flattenPlan,
  validatePlannerItem,
};

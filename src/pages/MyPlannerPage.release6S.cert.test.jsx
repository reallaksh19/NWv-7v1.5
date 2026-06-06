import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  __myPlannerPageViewModelInternalsForTest,
} from '../viewModels/useMyPlannerPageViewModel.js';

const read = path => fs.readFileSync(path, 'utf8');

describe('Release 6S MyPlannerPage ViewModel binding', () => {
  const page = read('src/pages/MyPlannerPage.jsx');
  const vm = read('src/viewModels/useMyPlannerPageViewModel.js');

  it('MyPlannerPage no longer owns planner storage/service orchestration', () => {
    [
      "from '../utils/plannerStorage'",
      "from '../services/plannerEvidence'",
      "from '../services/plannerViewModel'",
      "from '../services/plannerBulkActions'",
      "from '../services/plannerItemInspector'",
      "from '../services/plannerAgendaExport'",
      "from '../services/plannerInteractionQuality'",
      "from '../services/plannerStateHygiene'",
    ].forEach(source => {
      expect(page).not.toContain(source);
    });

    expect(page).not.toContain('plannerStorage.');
    expect(page).not.toContain('getPlannerEvidence(');
    expect(page).not.toContain('getPlannerViewModel(');
    expect(page).not.toContain('makePlannerSelectionKey(');
    expect(page).not.toContain('getPlannerAgendaExport(');
    expect(page).toContain('useMyPlannerPageViewModel');
  });

  it('ViewModel owns planner storage, bulk, inspector, export and hygiene logic', () => {
    [
      'plannerStorage.getPlan',
      'plannerStorage.removeItem',
      'plannerStorage.addItem',
      'downloadCalendarEvent',
      'downloadCalendarEvents',
      'getPlannerEvidence',
      'getPlannerViewModel',
      'getPlannerBulkActionSummary',
      'makePlannerSelectionKey',
      'getPlannerItemInspector',
      'getPlannerAgendaExport',
      'buildPlannerAgendaText',
      'buildPlannerAgendaJson',
      'downloadPlannerAgendaFile',
      'getPlannerInteractionQuality',
      'getPlannerStateHygiene',
      'reconcilePlannerSelection',
      'buildPlannerGroups',
    ].forEach(token => {
      expect(vm).toContain(token);
    });
  });

  it('MyPlannerPage preserves planner UI panels', () => {
    [
      'PlannerControlsPanel',
      'PlannerBulkActionBar',
      'PlannerItemInspectorPanel',
      'PlannerEvidencePanel',
      'PlannerAgendaExportPanel',
      'PlannerInteractionQualityPanel',
      'PlannerStateHygienePanel',
      'SwipeableItem',
    ].forEach(token => {
      expect(page).toContain(token);
    });
  });

  it('ViewModel exposes stable planner defaults and timers', () => {
    const {
      DEFAULT_PLANNER_CONTROLS,
      UNDO_VISIBLE_MS,
      COPY_STATUS_VISIBLE_MS,
    } = __myPlannerPageViewModelInternalsForTest;

    expect(DEFAULT_PLANNER_CONTROLS).toEqual({
      query: '',
      category: 'all',
      dateWindow: 'all',
      sortMode: 'date',
    });
    expect(UNDO_VISIBLE_MS).toBe(5000);
    expect(COPY_STATUS_VISIBLE_MS).toBe(1800);
  });

  it('buildPlannerGroups projects selection metadata for the page', () => {
    const { buildPlannerGroups } = __myPlannerPageViewModelInternalsForTest;

    const groups = buildPlannerGroups([
      {
        dateKey: '2026-05-29',
        items: [
          {
            id: 'item-1',
            title: 'Planner item',
            dateKey: '2026-05-29',
          },
        ],
      },
    ], ['2026-05-29::item-1']);

    expect(groups[0].items[0]).toMatchObject({
      plannerSelectionKey: '2026-05-29::item-1',
      plannerSelected: true,
    });
  });
});

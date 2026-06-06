import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('MyPlannerPage Release 5F-B migration', () => {
  const src = fs.readFileSync('src/pages/MyPlannerPage.jsx', 'utf8');

  it('uses Planner ViewModel and DataStateBoundary', () => {
    expect(src).toContain('usePlannerTabViewModel');
    expect(src).toContain('DataStateBoundary');
  });

  it('does not import plannerStorage directly', () => {
    expect(src).not.toContain("from '../utils/plannerStorage'");
    expect(src).not.toContain('plannerStorage');
  });

  it('does not import planner service modules directly', () => {
    expect(src).not.toContain("from '../services/plannerEvidence'");
    expect(src).not.toContain("from '../services/plannerViewModel'");
    expect(src).not.toContain("from '../services/plannerBulkActions'");
    expect(src).not.toContain("from '../services/plannerItemInspector'");
    expect(src).not.toContain("from '../services/plannerAgendaExport'");
    expect(src).not.toContain("from '../services/plannerInteractionQuality'");
    expect(src).not.toContain("from '../services/plannerStateHygiene'");
    expect(src).not.toContain('getPlannerEvidence');
    expect(src).not.toContain('getPlannerViewModel');
    expect(src).not.toContain('getPlannerBulkActionSummary');
    expect(src).not.toContain('makePlannerSelectionKey');
    expect(src).not.toContain('getPlannerItemInspector');
    expect(src).not.toContain('getPlannerAgendaExport');
    expect(src).not.toContain('getPlannerInteractionQuality');
    expect(src).not.toContain('getPlannerStateHygiene');
    expect(src).not.toContain('reconcilePlannerSelection');
  });

  it('does not import calendar download utilities directly', () => {
    expect(src).not.toContain('downloadCalendarEvent');
    expect(src).not.toContain('downloadCalendarEvents');
  });

  it('keeps page-level panel components', () => {
    expect(src).toContain('function PlannerControlsPanel');
    expect(src).toContain('function PlannerBulkActionBar');
    expect(src).toContain('function PlannerAgendaExportPanel');
    expect(src).toContain('function PlannerItemInspectorPanel');
  });

  it('preserves planner UI panels', () => {
    expect(src).toContain('PlannerControlsPanel');
    expect(src).toContain('PlannerBulkActionBar');
    expect(src).toContain('PlannerItemInspectorPanel');
    expect(src).toContain('PlannerEvidencePanel');
    expect(src).toContain('PlannerAgendaExportPanel');
    expect(src).toContain('PlannerInteractionQualityPanel');
    expect(src).toContain('PlannerStateHygienePanel');
  });

  it('routes actions through ViewModel wrappers', () => {
    expect(src).toContain('removeWithUndo');
    expect(src).toContain('undoLastRemove');
    expect(src).toContain('exportPlannerItem');
    expect(src).toContain('removeSelectedPlannerItems');
    expect(src).toContain('copyPlannerAgendaText');
  });

  it('uses planner empty state through DataStateBoundary-ready UI', () => {
    expect(src).toContain('treatEmptyAsReady={true}');
    expect(src).toContain('Your planner is empty');
  });
});

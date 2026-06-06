import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import {
  __plannerViewModelInternalsForTest,
} from './usePlannerTabViewModel.js';

const {
  DEFAULT_PLANNER_CONTROLS,
  UNDO_CLEAR_MS,
  COPY_STATUS_CLEAR_MS,
  getPlannerDateKey,
  groupPlannerItems,
  getPlanDataFromEnvelope,
  getPlannerStorageItemId,
  makeUndoPayloadForSingle,
  makeUndoPayloadForBulk,
  safeConfirm,
  safePrint,
  writeClipboardFallback,
} = __plannerViewModelInternalsForTest;

describe('usePlannerTabViewModel static checks', () => {
  const src = fs.readFileSync('src/viewModels/usePlannerTabViewModel.js', 'utf8');

  it('uses planner dataset', () => {
    expect(src).toContain("useDataset('planner')");
  });

  it('owns planner storage and service orchestration', () => {
    expect(src).toContain('plannerStorage');
    expect(src).toContain('getPlannerEvidence');
    expect(src).toContain('getPlannerViewModel');
    expect(src).toContain('getPlannerBulkActionSummary');
    expect(src).toContain('getPlannerItemInspector');
    expect(src).toContain('getPlannerAgendaExport');
    expect(src).toContain('getPlannerInteractionQuality');
    expect(src).toContain('getPlannerStateHygiene');
  });

  it('guards async state and clears timers', () => {
    expect(src).toContain('useMountedRef');
    expect(src).toContain('mountedRef.current');
    expect(src).toContain('clearTimeout');
  });

  it('guards browser globals', () => {
    expect(src).toContain('safeConfirm');
    expect(src).toContain('safePrint');
    expect(src).toContain('typeof navigator !==');
    expect(src).toContain('typeof document ===');
    expect(src).toContain('writeClipboardFallback');
  });

  it('checks plannerStorage boolean return values', () => {
    expect(src).toContain('const removed = plannerStorage.removeItem');
    expect(src).toContain('const restored = plannerStorage.addItem');
    expect(src).toContain('Planner item was not removed');
    expect(src).toContain('Planner item was not restored');
  });

  it('uses canonical storage identity during bulk removal', () => {
    expect(src).toContain('getPlannerStorageItemId(item.raw || item)');
  });

  it('exposes UI action wrappers', () => {
    expect(src).toContain('removeWithUndo');
    expect(src).toContain('undoLastRemove');
    expect(src).toContain('copyPlannerAgendaText');
    expect(src).toContain('removeSelectedPlannerItems');
    expect(src).toContain('exportSelectedPlannerItems');
    expect(src).toContain('inspectPlannerItem');
  });
});

describe('Planner ViewModel internals', () => {
  it('defines default controls and timeout constants', () => {
    expect(DEFAULT_PLANNER_CONTROLS).toEqual({
      query: '',
      category: 'all',
      dateWindow: 'all',
      sortMode: 'date',
    });
    expect(UNDO_CLEAR_MS).toBe(5000);
    expect(COPY_STATUS_CLEAR_MS).toBe(1800);
  });

  it('gets planner date key with fallback', () => {
    expect(getPlannerDateKey({ planDate: '2026-05-28' })).toBe('2026-05-28');
    expect(getPlannerDateKey({ eventDateKey: '2026-05-29' })).toBe('2026-05-29');
    expect(getPlannerDateKey({})).toBe('undated');
  });

  it('groups planned items by planner date', () => {
    const result = groupPlannerItems([
      { title: 'A', planDate: '2026-05-28' },
      { title: 'B', planDate: '2026-05-28' },
      { title: 'C', planDate: '2026-05-29' },
    ]);

    expect(result['2026-05-28']).toHaveLength(2);
    expect(result['2026-05-29']).toHaveLength(1);
  });

  it('reads raw plan from canonical planner envelope', () => {
    const result = getPlanDataFromEnvelope({
      data: {
        raw: {
          plan: {
            '2026-05-28': [{ title: 'A' }],
          },
        },
      },
    });

    expect(result['2026-05-28']).toHaveLength(1);
  });

  it('falls back to plannedItems grouping', () => {
    const result = getPlanDataFromEnvelope({
      data: {
        plannedItems: [
          { title: 'A', planDate: '2026-05-28' },
        ],
      },
    });

    expect(result['2026-05-28']).toHaveLength(1);
  });

  it('gets storage item id safely', () => {
    expect(getPlannerStorageItemId({ hiddenKey: 'h1' })).toBe('h1');
    expect(getPlannerStorageItemId({ canonicalId: 'c1' })).toBe('c1');
    expect(getPlannerStorageItemId({ id: 'i1' })).toBe('i1');
    expect(getPlannerStorageItemId({ link: 'https://example.com' })).toBe('https://example.com');
  });

  it('builds undo payloads', () => {
    expect(makeUndoPayloadForSingle({ title: 'A' }, '2026-05-28')).toEqual({
      bulk: false,
      date: '2026-05-28',
      item: { title: 'A' },
    });

    expect(makeUndoPayloadForBulk([
      { dateKey: '2026-05-28', raw: { title: 'A' } },
      { dateKey: '2026-05-29', raw: { title: 'B' } },
    ])).toEqual({
      bulk: true,
      items: [
        { date: '2026-05-28', item: { title: 'A' } },
        { date: '2026-05-29', item: { title: 'B' } },
      ],
    });
  });

  it('safeConfirm defaults to true without browser confirm', () => {
    const originalWindow = globalThis.window;

    try {
      vi.stubGlobal('window', undefined);
      expect(safeConfirm('Confirm?')).toBe(true);
    } finally {
      vi.stubGlobal('window', originalWindow);
      vi.unstubAllGlobals();
    }
  });

  it('safePrint reports unavailable without browser print', () => {
    const originalWindow = globalThis.window;

    try {
      vi.stubGlobal('window', undefined);
      expect(safePrint()).toEqual({ ok: false, error: 'Print unavailable' });
    } finally {
      vi.stubGlobal('window', originalWindow);
      vi.unstubAllGlobals();
    }
  });

  it('writeClipboardFallback returns false without document', () => {
    const originalDocument = globalThis.document;

    try {
      vi.stubGlobal('document', undefined);
      expect(writeClipboardFallback('x')).toBe(false);
    } finally {
      vi.stubGlobal('document', originalDocument);
      vi.unstubAllGlobals();
    }
  });
});

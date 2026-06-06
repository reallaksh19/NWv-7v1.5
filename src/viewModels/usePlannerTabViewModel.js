import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDataset } from '../data/orchestrator/useDataset.js';
import { useMountedRef } from '../hooks/useMountedRef.js';
import plannerStorage, {
  getPlannerStorageError,
  isPlannerStorageSuccess,
} from '../utils/plannerStorage';
import { downloadCalendarEvent, downloadCalendarEvents } from '../utils/calendar';
import { getPlannerEvidence } from '../services/plannerEvidence';
import { getPlannerViewModel } from '../services/plannerViewModel';
import { getPlannerBulkActionSummary, makePlannerSelectionKey } from '../services/plannerBulkActions';
import { getPlannerItemInspector } from '../services/plannerItemInspector';
import {
  buildPlannerAgendaJson,
  buildPlannerAgendaText,
  downloadPlannerAgendaFile,
  getPlannerAgendaExport,
  makePlannerAgendaFilename,
} from '../services/plannerAgendaExport';
import { getPlannerInteractionQuality } from '../services/plannerInteractionQuality';
import { getPlannerStateHygiene, reconcilePlannerSelection } from '../services/plannerStateHygiene';

const DEFAULT_PLANNER_CONTROLS = Object.freeze({
  query: '',
  category: 'all',
  dateWindow: 'all',
  sortMode: 'date',
});

const UNDO_CLEAR_MS = 5000;
const COPY_STATUS_CLEAR_MS = 1800;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getPlannerDateKey(item = {}) {
  return item.planDate || item.eventDateKey || item.eventDate || item.date || 'undated';
}

function groupPlannerItems(items = []) {
  return asArray(items).reduce((acc, item) => {
    const dateKey = getPlannerDateKey(item);

    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(item.raw || item);

    return acc;
  }, {});
}

function getPlanDataFromEnvelope(envelope) {
  const data = envelope?.data || {};

  if (isPlainObject(data.raw?.plan)) {
    return data.raw.plan;
  }

  if (isPlainObject(data.plan)) {
    return data.plan;
  }

  if (Array.isArray(data.plannedItems)) {
    return groupPlannerItems(data.plannedItems);
  }

  if (Array.isArray(data.calendarExportableItems)) {
    return groupPlannerItems(data.calendarExportableItems);
  }

  return {};
}

function getPlannerStorageItemId(item = {}) {
  return item.hiddenKey || item.canonicalId || item.id || item.link;
}

function makeUndoPayloadForSingle(item, dateKey) {
  return {
    bulk: false,
    date: dateKey,
    item: item.raw || item,
  };
}

function makeUndoPayloadForBulk(selectedItems = []) {
  return {
    bulk: true,
    items: selectedItems.map(item => ({
      date: item.dateKey,
      item: item.raw || item,
    })),
  };
}

function safeConfirm(message) {
  if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
    return true;
  }

  return window.confirm(message);
}

function safePrint() {
  if (typeof window !== 'undefined' && typeof window.print === 'function') {
    window.print();
    return { ok: true };
  }

  return { ok: false, error: 'Print unavailable' };
}

function writeClipboardFallback(text) {
  if (typeof document === 'undefined') {
    return false;
  }

  const textarea = document.createElement('textarea');

  textarea.value = text;
  textarea.setAttribute('readonly', 'readonly');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';

  document.body.appendChild(textarea);
  textarea.select();

  const copied = document.execCommand?.('copy') === true;

  document.body.removeChild(textarea);

  return copied;
}

export function usePlannerTabViewModel() {
  const {
    envelope,
    loading,
    error: datasetError,
    reload: reloadDataset,
  } = useDataset('planner');

  const mountedRef = useMountedRef();
  const undoTimerRef = useRef(null);
  const copyStatusTimerRef = useRef(null);

  const [plannerControls, setPlannerControls] = useState(DEFAULT_PLANNER_CONTROLS);
  const [selectedPlannerIds, setSelectedPlannerIds] = useState([]);
  const [inspectedPlannerItem, setInspectedPlannerItem] = useState(null);
  const [plannerAgendaCopyStatus, setPlannerAgendaCopyStatus] = useState('');
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [undoItem, setUndoItem] = useState(null);

  const planData = useMemo(() => getPlanDataFromEnvelope(envelope), [envelope]);

  const plannerEvidence = useMemo(() => (
    getPlannerEvidence(planData)
  ), [planData]);

  const plannerViewModel = useMemo(() => (
    getPlannerViewModel(planData, plannerControls)
  ), [planData, plannerControls]);

  const plannerBulkSummary = useMemo(() => (
    getPlannerBulkActionSummary(plannerViewModel.filteredItems, selectedPlannerIds)
  ), [plannerViewModel.filteredItems, selectedPlannerIds]);

  const inspectedPlannerDetail = useMemo(() => (
    inspectedPlannerItem
      ? getPlannerItemInspector(inspectedPlannerItem.item, inspectedPlannerItem.dateKey)
      : null
  ), [inspectedPlannerItem]);

  const plannerAgendaExport = useMemo(() => (
    getPlannerAgendaExport({
      viewModel: plannerViewModel,
      controls: plannerControls,
    })
  ), [plannerViewModel, plannerControls]);

  const plannerInteractionQuality = useMemo(() => (
    getPlannerInteractionQuality({
      totalCount: plannerViewModel.totalCount,
      filteredCount: plannerViewModel.filteredCount,
      selectedCount: plannerBulkSummary.selectedCount,
      inspectorOpen: Boolean(inspectedPlannerDetail),
      agendaEmpty: plannerAgendaExport.empty,
      copyStatus: plannerAgendaCopyStatus,
    })
  ), [
    plannerViewModel.totalCount,
    plannerViewModel.filteredCount,
    plannerBulkSummary.selectedCount,
    inspectedPlannerDetail,
    plannerAgendaExport.empty,
    plannerAgendaCopyStatus,
  ]);

  const plannerStateHygiene = useMemo(() => (
    getPlannerStateHygiene({
      filteredItems: plannerViewModel.filteredItems,
      selectedKeys: selectedPlannerIds,
      inspectedPlannerItem,
    })
  ), [plannerViewModel.filteredItems, selectedPlannerIds, inspectedPlannerItem]);

  const sortedDates = useMemo(() => (
    plannerViewModel.groupedDates.map(group => group.dateKey)
  ), [plannerViewModel.groupedDates]);

  const error = datasetError || envelope?.error || null;

  const reload = useCallback((force = true) => {
    return reloadDataset(force);
  }, [reloadDataset]);

  const scheduleUndoClear = useCallback(() => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }

    undoTimerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setUndoItem(null);
      }
    }, UNDO_CLEAR_MS);
  }, [mountedRef]);

  const scheduleCopyStatusClear = useCallback(() => {
    if (copyStatusTimerRef.current) {
      clearTimeout(copyStatusTimerRef.current);
    }

    copyStatusTimerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setPlannerAgendaCopyStatus('');
      }
    }, COPY_STATUS_CLEAR_MS);
  }, [mountedRef]);

  const removeWithUndo = useCallback(async (item, dateKey) => {
    const id = getPlannerStorageItemId(item);

    if (!id || !plannerStorage.removeItem) {
      return {
        ok: false,
        error: 'Missing planner item id or remove handler',
      };
    }

    try {
      const removed = plannerStorage.removeItem(dateKey, id);

      if (!isPlannerStorageSuccess(removed)) {
        return {
          ok: false,
          error: getPlannerStorageError(removed, 'Planner item was not removed'),
        };
      }

      if (mountedRef.current) {
        setUndoItem(makeUndoPayloadForSingle(item, dateKey));
      }

      await reloadDataset(true);
      scheduleUndoClear();

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error?.message || String(error),
      };
    }
  }, [mountedRef, reloadDataset, scheduleUndoClear]);

  const undoLastRemove = useCallback(async () => {
    if (!undoItem) {
      return { ok: false, error: 'Nothing to undo' };
    }

    try {
      if (undoItem.bulk) {
        const failures = [];

        undoItem.items.forEach(entry => {
          const restored = plannerStorage.addItem?.(entry.date, entry.item);

          if (!isPlannerStorageSuccess(restored)) {
            failures.push(entry);
          }
        });

        if (failures.length > 0) {
          return {
            ok: false,
            error: `${failures.length} planner item(s) were not restored`,
          };
        }
      } else {
        const restored = plannerStorage.addItem?.(undoItem.date, undoItem.item);

        if (!isPlannerStorageSuccess(restored)) {
          return {
            ok: false,
            error: getPlannerStorageError(restored, 'Planner item was not restored'),
          };
        }
      }

      if (mountedRef.current) {
        setUndoItem(null);
      }

      await reloadDataset(true);

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error?.message || String(error),
      };
    }
  }, [mountedRef, reloadDataset, undoItem]);

  const handleLongPress = useCallback((item, dateKey) => {
    if (safeConfirm(`Remove "${item.title}" from your planner?`)) {
      return removeWithUndo(item, dateKey);
    }

    return { ok: false, error: 'User cancelled' };
  }, [removeWithUndo]);

  const copyPlannerAgendaText = useCallback(async () => {
    const text = buildPlannerAgendaText(plannerAgendaExport);

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const copied = writeClipboardFallback(text);

        if (!copied) {
          throw new Error('Clipboard unavailable');
        }
      }

      if (mountedRef.current) {
        setPlannerAgendaCopyStatus('Copied');
      }

      scheduleCopyStatusClear();

      return { ok: true };
    } catch (error) {
      if (mountedRef.current) {
        setPlannerAgendaCopyStatus('Copy failed');
      }

      scheduleCopyStatusClear();

      return {
        ok: false,
        error: error?.message || String(error),
      };
    }
  }, [mountedRef, plannerAgendaExport, scheduleCopyStatusClear]);

  const downloadPlannerAgendaTextFile = useCallback(() => {
    downloadPlannerAgendaFile(
      makePlannerAgendaFilename('txt'),
      buildPlannerAgendaText(plannerAgendaExport),
      'text/plain;charset=utf-8'
    );
  }, [plannerAgendaExport]);

  const downloadPlannerAgendaJsonFile = useCallback(() => {
    downloadPlannerAgendaFile(
      makePlannerAgendaFilename('json'),
      buildPlannerAgendaJson(plannerAgendaExport),
      'application/json;charset=utf-8'
    );
  }, [plannerAgendaExport]);

  const printPlannerAgenda = useCallback(() => {
    return safePrint();
  }, []);

  const inspectPlannerItem = useCallback((item, dateKey) => {
    setInspectedPlannerItem({ item, dateKey });
  }, []);

  const closePlannerInspector = useCallback(() => {
    setInspectedPlannerItem(null);
  }, []);

  const exportPlannerItem = useCallback((item) => {
    try {
      downloadCalendarEvent(item.raw || item);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error?.message || String(error),
      };
    }
  }, []);

  const exportInspectedPlannerItem = useCallback((detail) => {
    try {
      downloadCalendarEvent(detail.raw || detail);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error?.message || String(error),
      };
    }
  }, []);

  const removeInspectedPlannerItem = useCallback(async (detail) => {
    const result = await removeWithUndo(detail.raw || detail, detail.dateKey);

    if (result.ok) {
      closePlannerInspector();
    }

    return result;
  }, [closePlannerInspector, removeWithUndo]);

  const getPlannerItemKey = useCallback((item) => {
    return makePlannerSelectionKey(item);
  }, []);

  const isPlannerItemSelected = useCallback((item) => {
    return selectedPlannerIds.includes(makePlannerSelectionKey(item));
  }, [selectedPlannerIds]);

  const togglePlannerSelection = useCallback((item) => {
    const selectionKey = makePlannerSelectionKey(item);

    setSelectedPlannerIds(prev => (
      prev.includes(selectionKey)
        ? prev.filter(key => key !== selectionKey)
        : [...prev, selectionKey]
    ));
  }, []);

  const selectAllFilteredPlannerItems = useCallback(() => {
    setSelectedPlannerIds(plannerViewModel.filteredItems.map(makePlannerSelectionKey));
  }, [plannerViewModel.filteredItems]);

  const clearPlannerSelection = useCallback(() => {
    setSelectedPlannerIds([]);
  }, []);

  const exportSelectedPlannerItems = useCallback(() => {
    try {
      const exported = downloadCalendarEvents(
        plannerBulkSummary.selectedItems.map(item => item.raw || item),
        'nwv7_planner_selection.ics'
      );

      if (!exported) {
        return { ok: false, error: 'No selected planner items were exported' };
      }

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error?.message || String(error),
      };
    }
  }, [plannerBulkSummary.selectedItems]);

  const removeSelectedPlannerItems = useCallback(async () => {
    if (plannerBulkSummary.selectedItems.length === 0) {
      return { ok: false, error: 'No selected planner items' };
    }

    try {
      const undoPayload = makeUndoPayloadForBulk(plannerBulkSummary.selectedItems);
      const failures = [];

      plannerBulkSummary.selectedItems.forEach(item => {
        const id = getPlannerStorageItemId(item.raw || item);
        const removed = plannerStorage.removeItem?.(item.dateKey, id);

        if (!removed) {
          failures.push(item);
        }
      });

      if (failures.length > 0) {
        return {
          ok: false,
          error: `${failures.length} planner item(s) were not removed`,
        };
      }

      if (mountedRef.current) {
        setUndoItem(undoPayload);
        setSelectedPlannerIds([]);
      }

      await reloadDataset(true);
      scheduleUndoClear();

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error?.message || String(error),
      };
    }
  }, [mountedRef, plannerBulkSummary.selectedItems, reloadDataset, scheduleUndoClear]);

  useEffect(() => {
    const reconciliation = reconcilePlannerSelection(
      plannerViewModel.filteredItems,
      selectedPlannerIds
    );

    if (reconciliation.changed) {
      queueMicrotask(() => {
        if (mountedRef.current) {
          setSelectedPlannerIds(reconciliation.selectedKeys);
        }
      });
    }
  }, [mountedRef, plannerViewModel.filteredItems, selectedPlannerIds]);

  useEffect(() => {
    if (!inspectedPlannerItem) return;

    if (!plannerStateHygiene.inspectorValid) {
      queueMicrotask(() => {
        if (mountedRef.current) {
          setInspectedPlannerItem(null);
        }
      });
    }
  }, [inspectedPlannerItem, mountedRef, plannerStateHygiene.inspectorValid]);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      if (copyStatusTimerRef.current) clearTimeout(copyStatusTimerRef.current);
    };
  }, []);

  return {
    envelope,
    loading,
    error,
    reload,
    planData,
    plannerControls,
    setPlannerControls,
    selectedPlannerIds,
    setSelectedPlannerIds,
    inspectedPlannerItem,
    setInspectedPlannerItem,
    plannerAgendaCopyStatus,
    showDiagnostics,
    setShowDiagnostics,
    undoItem,
    plannerEvidence,
    plannerViewModel,
    plannerBulkSummary,
    inspectedPlannerDetail,
    plannerAgendaExport,
    plannerInteractionQuality,
    plannerStateHygiene,
    sortedDates,
    removeWithUndo,
    undoLastRemove,
    handleLongPress,
    copyPlannerAgendaText,
    downloadPlannerAgendaTextFile,
    downloadPlannerAgendaJsonFile,
    printPlannerAgenda,
    inspectPlannerItem,
    closePlannerInspector,
    exportPlannerItem,
    exportInspectedPlannerItem,
    removeInspectedPlannerItem,
    getPlannerItemKey,
    isPlannerItemSelected,
    togglePlannerSelection,
    selectAllFilteredPlannerItems,
    clearPlannerSelection,
    exportSelectedPlannerItems,
    removeSelectedPlannerItems,
    source: envelope?.source || null,
    freshness: envelope?.freshness || null,
    slo: envelope?.slo || null,
    warnings: [
      ...(Array.isArray(envelope?.validation?.warnings) ? envelope.validation.warnings : []),
      ...(Array.isArray(envelope?.slo?.warnings) ? envelope.slo.warnings : []),
    ],
    diagnostics: envelope?.diagnostics || [],
  };
}

export const __plannerViewModelInternalsForTest = {
  DEFAULT_PLANNER_CONTROLS,
  UNDO_CLEAR_MS,
  COPY_STATUS_CLEAR_MS,
  asArray,
  isPlainObject,
  getPlannerDateKey,
  groupPlannerItems,
  getPlanDataFromEnvelope,
  getPlannerStorageItemId,
  makeUndoPayloadForSingle,
  makeUndoPayloadForBulk,
  safeConfirm,
  safePrint,
  writeClipboardFallback,
};

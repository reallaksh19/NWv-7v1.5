import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import plannerStorage, {
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

const UNDO_VISIBLE_MS = 5000;
const COPY_STATUS_VISIBLE_MS = 1800;

function safeGetPlan() {
  try {
    if (typeof plannerStorage.getPlan === 'function') {
      return plannerStorage.getPlan() || {};
    }
  } catch (error) {
    console.warn('[useMyPlannerPageViewModel] Failed to read planner data', {
      message: error?.message || String(error),
    });
  }

  return {};
}

function safeWindowConfirm(message) {
  if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
    return true;
  }

  return window.confirm(message);
}

async function copyTextToClipboard(text) {
  if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

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

  try {
    document.execCommand('copy');
    return true;
  } finally {
    document.body.removeChild(textarea);
  }
}

function safePrint() {
  if (typeof window !== 'undefined' && typeof window.print === 'function') {
    window.print();
  }
}

function clearTimer(timerRef) {
  if (timerRef?.current) {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}

function getPlannerItemId(item) {
  return item?.hiddenKey || item?.canonicalId || item?.id || item?.raw?.hiddenKey || item?.raw?.canonicalId || item?.raw?.id;
}

function buildPlannerGroups(groupedDates, selectedKeys) {
  const selectedSet = new Set(Array.isArray(selectedKeys) ? selectedKeys : []);

  return (Array.isArray(groupedDates) ? groupedDates : []).map(group => ({
    ...group,
    items: (Array.isArray(group.items) ? group.items : []).map(item => {
      const selectionKey = makePlannerSelectionKey(item);

      return {
        ...item,
        plannerSelectionKey: selectionKey,
        plannerSelected: selectedSet.has(selectionKey),
      };
    }),
  }));
}

function getRawPlannerItem(item) {
  return item?.raw || item;
}

export function useMyPlannerPageViewModel() {
  const [planData, setPlanData] = useState({});
  const [undoItem, setUndoItem] = useState(null);
  const [plannerControls, setPlannerControls] = useState(() => ({ ...DEFAULT_PLANNER_CONTROLS }));
  const [selectedPlannerIds, setSelectedPlannerIds] = useState([]);
  const [inspectedPlannerItem, setInspectedPlannerItem] = useState(null);
  const [plannerAgendaCopyStatus, setPlannerAgendaCopyStatus] = useState('');
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const plannerInspectorRef = useRef(null);
  const undoTimerRef = useRef(null);
  const copyStatusTimerRef = useRef(null);

  const loadPlan = useCallback(() => {
    setPlanData(safeGetPlan());
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      loadPlan();
    });

    return () => {
      clearTimer(undoTimerRef);
      clearTimer(copyStatusTimerRef);
    };
  }, [loadPlan]);

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

  useEffect(() => {
    if (!inspectedPlannerItem) return undefined;
    if (typeof window === 'undefined') return undefined;

    const handlePlannerEscape = (event) => {
      if (event.key === 'Escape') {
        setInspectedPlannerItem(null);
      }
    };

    window.addEventListener('keydown', handlePlannerEscape);

    return () => {
      window.removeEventListener('keydown', handlePlannerEscape);
    };
  }, [inspectedPlannerItem]);

  useEffect(() => {
    const reconciliation = reconcilePlannerSelection(
      plannerViewModel.filteredItems,
      selectedPlannerIds
    );

    if (reconciliation.changed) {
      queueMicrotask(() => setSelectedPlannerIds(reconciliation.selectedKeys));
    }
  }, [plannerViewModel.filteredItems, selectedPlannerIds]);

  useEffect(() => {
    if (!inspectedPlannerItem) return;

    if (!plannerStateHygiene.inspectorValid) {
      queueMicrotask(() => setInspectedPlannerItem(null));
    }
  }, [inspectedPlannerItem, plannerStateHygiene.inspectorValid]);

  useEffect(() => {
    if (inspectedPlannerDetail && plannerInspectorRef.current) {
      plannerInspectorRef.current.focus();
    }
  }, [inspectedPlannerDetail]);

  const setUndoWithTimeout = useCallback((nextUndoItem) => {
    clearTimer(undoTimerRef);
    setUndoItem(nextUndoItem);

    undoTimerRef.current = setTimeout(() => {
      setUndoItem(null);
      undoTimerRef.current = null;
    }, UNDO_VISIBLE_MS);
  }, []);

  const removeWithUndo = useCallback((item, dateKey) => {
    const id = getPlannerItemId(item);

    if (!id) return false;

    if (typeof plannerStorage.removeItem === 'function') {
      const removed = plannerStorage.removeItem(dateKey, id);

      if (isPlannerStorageSuccess(removed)) {
        setUndoWithTimeout({
          bulk: false,
          date: dateKey,
          item: getRawPlannerItem(item),
        });

        loadPlan();
        return true;
      }
    }

    return false;
  }, [loadPlan, setUndoWithTimeout]);

  const undoLastRemove = useCallback(() => {
    if (!undoItem) return;

    if (undoItem.bulk) {
      undoItem.items.forEach(entry => {
        const restored = plannerStorage.addItem?.(entry.date, entry.item);
        if (!isPlannerStorageSuccess(restored)) {
          console.warn('[Planner] Undo restore failed', restored);
        }
      });
    } else {
      const restored = plannerStorage.addItem?.(undoItem.date, undoItem.item);
      if (!isPlannerStorageSuccess(restored)) {
        console.warn('[Planner] Undo restore failed', restored);
      }
    }

    clearTimer(undoTimerRef);
    setUndoItem(null);
    loadPlan();
  }, [loadPlan, undoItem]);

  const handleLongPress = useCallback((item, dateKey) => {
    if (safeWindowConfirm(`Remove "${item?.title || 'this item'}" from your planner?`)) {
      removeWithUndo(item, dateKey);
    }
  }, [removeWithUndo]);

  const copyPlannerAgendaText = useCallback(async () => {
    const text = buildPlannerAgendaText(plannerAgendaExport);

    try {
      await copyTextToClipboard(text);
      setPlannerAgendaCopyStatus('Copied');
    } catch {
      setPlannerAgendaCopyStatus('Copy failed');
    }

    clearTimer(copyStatusTimerRef);
    copyStatusTimerRef.current = setTimeout(() => {
      setPlannerAgendaCopyStatus('');
      copyStatusTimerRef.current = null;
    }, COPY_STATUS_VISIBLE_MS);
  }, [plannerAgendaExport]);

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
    safePrint();
  }, []);

  const inspectPlannerItem = useCallback((item, dateKey) => {
    setInspectedPlannerItem({ item, dateKey });
  }, []);

  const closePlannerInspector = useCallback(() => {
    setInspectedPlannerItem(null);
  }, []);

  const exportInspectedPlannerItem = useCallback((detail) => {
    downloadCalendarEvent(detail?.raw || detail);
  }, []);

  const removeInspectedPlannerItem = useCallback((detail) => {
    removeWithUndo(detail?.raw || detail, detail?.dateKey);
    setInspectedPlannerItem(null);
  }, [removeWithUndo]);

  const togglePlannerSelection = useCallback((item) => {
    const selectionKey = item?.plannerSelectionKey || makePlannerSelectionKey(item);

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
    downloadCalendarEvents(
      plannerBulkSummary.selectedItems.map(item => getRawPlannerItem(item)),
      'nwv7_planner_selection.ics'
    );
  }, [plannerBulkSummary.selectedItems]);

  const removeSelectedPlannerItems = useCallback(() => {
    if (plannerBulkSummary.selectedItems.length === 0) return;

    const removedItems = plannerBulkSummary.selectedItems.map(item => ({
      date: item.dateKey,
      item: getRawPlannerItem(item),
    }));

    plannerBulkSummary.selectedItems.forEach(item => {
      plannerStorage.removeItem?.(item.dateKey, getPlannerItemId(item));
    });

    setUndoWithTimeout({
      bulk: true,
      items: removedItems,
    });

    setSelectedPlannerIds([]);
    loadPlan();
  }, [loadPlan, plannerBulkSummary.selectedItems, setUndoWithTimeout]);

  const plannerGroups = useMemo(() => (
    buildPlannerGroups(plannerViewModel.groupedDates, selectedPlannerIds)
  ), [plannerViewModel.groupedDates, selectedPlannerIds]);

  const sortedDates = useMemo(() => (
    plannerGroups.map(group => group.dateKey)
  ), [plannerGroups]);

  return {
    planData,
    undoItem,

    plannerControls,
    setPlannerControls,

    selectedPlannerIds,
    inspectedPlannerDetail,
    plannerInspectorRef,
    plannerAgendaCopyStatus,
    showDiagnostics,
    setShowDiagnostics,

    plannerEvidence,
    plannerViewModel,
    plannerGroups,
    plannerBulkSummary,
    plannerAgendaExport,
    plannerInteractionQuality,
    plannerStateHygiene,

    sortedDates,

    loadPlan,
    removeWithUndo,
    undoLastRemove,
    handleLongPress,

    copyPlannerAgendaText,
    downloadPlannerAgendaTextFile,
    downloadPlannerAgendaJsonFile,
    printPlannerAgenda,

    inspectPlannerItem,
    closePlannerInspector,
    exportInspectedPlannerItem,
    exportPlannerItem: exportInspectedPlannerItem, // single-item calendar export alias
    removeInspectedPlannerItem,

    togglePlannerSelection,
    selectAllFilteredPlannerItems,
    clearPlannerSelection,
    exportSelectedPlannerItems,
    removeSelectedPlannerItems,
  };
}

export const __myPlannerPageViewModelInternalsForTest = {
  DEFAULT_PLANNER_CONTROLS,
  UNDO_VISIBLE_MS,
  COPY_STATUS_VISIBLE_MS,
  safeGetPlan,
  safeWindowConfirm,
  copyTextToClipboard,
  safePrint,
  clearTimer,
  getPlannerItemId,
  buildPlannerGroups,
  getRawPlannerItem,
};

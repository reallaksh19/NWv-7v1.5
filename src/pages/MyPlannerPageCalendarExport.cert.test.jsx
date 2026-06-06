// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const exportPlannerItem = vi.fn();

vi.mock('../components/Header', () => ({
  default: () => <header data-testid="planner-header" />,
}));

vi.mock('../viewModels/useShellRuntimeProps', () => ({
  useShellRuntimeProps: () => ({}),
}));

vi.mock('../viewModels/useMyPlannerPageViewModel', () => ({
  useMyPlannerPageViewModel: () => ({
    undoItem: null,
    plannerControls: {
      query: '',
      category: 'all',
      dateWindow: 'all',
      sortMode: 'date',
    },
    setPlannerControls: vi.fn(),
    inspectedPlannerDetail: null,
    plannerInspectorRef: { current: null },
    plannerAgendaCopyStatus: '',
    showDiagnostics: false,
    setShowDiagnostics: vi.fn(),
    plannerEvidence: {
      totalItems: 1,
      actionableItems: 1,
      missingDateItems: [],
      categories: {},
    },
    plannerViewModel: {
      totalCount: 1,
      filteredCount: 1,
      categoryOptions: ['all'],
      groupedDates: [],
    },
    plannerGroups: [
      {
        dateKey: '2026-05-30',
        items: [
          {
            id: 'planner-item-1',
            plannerSelectionKey: '2026-05-30::planner-item-1',
            plannerSelected: false,
            title: 'Test calendar item',
            category: 'event',
            link: 'https://example.com/event',
            raw: {
              id: 'raw-planner-item-1',
              title: 'Raw calendar item',
            },
          },
        ],
      },
    ],
    plannerBulkSummary: {
      hasSelection: false,
      title: 'No items selected',
      filteredCount: 1,
      allFilteredSelected: false,
      selectedCount: 0,
      selectedItems: [],
    },
    plannerAgendaExport: {
      empty: true,
      title: 'Planner agenda',
      rangeLabel: 'All dates',
      itemCount: 1,
      groupedItems: [],
      warnings: [],
    },
    plannerInteractionQuality: {
      grade: 'A',
      issues: [],
    },
    plannerStateHygiene: {
      grade: 'A',
      issues: [],
    },
    sortedDates: ['2026-05-30'],
    removeWithUndo: vi.fn(),
    undoLastRemove: vi.fn(),
    handleLongPress: vi.fn(),
    copyPlannerAgendaText: vi.fn(),
    downloadPlannerAgendaTextFile: vi.fn(),
    downloadPlannerAgendaJsonFile: vi.fn(),
    printPlannerAgenda: vi.fn(),
    inspectPlannerItem: vi.fn(),
    closePlannerInspector: vi.fn(),
    exportInspectedPlannerItem: vi.fn(),
    exportPlannerItem,
    removeInspectedPlannerItem: vi.fn(),
    togglePlannerSelection: vi.fn(),
    selectAllFilteredPlannerItems: vi.fn(),
    clearPlannerSelection: vi.fn(),
    exportSelectedPlannerItems: vi.fn(),
    removeSelectedPlannerItems: vi.fn(),
  }),
}));

import MyPlannerPage from './MyPlannerPage.jsx';

describe('MyPlannerPage calendar item export', () => {
  beforeEach(() => {
    exportPlannerItem.mockClear();
  });

  it('routes the per-item Add to Calendar action through the ViewModel export handler', async () => {
    render(<MyPlannerPage />);

    await userEvent.click(screen.getByTitle('Add to Calendar'));

    expect(exportPlannerItem).toHaveBeenCalledTimes(1);
    expect(exportPlannerItem).toHaveBeenCalledWith({
      id: 'raw-planner-item-1',
      title: 'Raw calendar item',
    });
  });
});

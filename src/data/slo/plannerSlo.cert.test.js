import { describe, expect, it } from 'vitest';
import { evaluatePlannerSlo } from './plannerSlo.js';

describe('plannerSlo', () => {
  it('fails when plannedItems is not an array', () => {
    const result = evaluatePlannerSlo({
      plannedItems: null,
      blacklist: [],
      calendarExportableItems: [],
      invalidItems: [],
    });

    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('planner_plannedItems_not_array');
  });

  it('fails when blacklist is not an array', () => {
    const result = evaluatePlannerSlo({
      plannedItems: [],
      blacklist: 'not-array',
      calendarExportableItems: [],
      invalidItems: [],
    });

    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('planner_blacklist_not_array');
  });

  it('fails when calendarExportableItems is not an array', () => {
    const result = evaluatePlannerSlo({
      plannedItems: [],
      blacklist: [],
      calendarExportableItems: undefined,
      invalidItems: [],
    });

    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('planner_calendarExportableItems_not_array');
  });

  it('fails when invalidItems is not an array', () => {
    const result = evaluatePlannerSlo({
      plannedItems: [],
      blacklist: [],
      calendarExportableItems: [],
      invalidItems: 42,
    });

    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('planner_invalidItems_not_array');
  });

  it('passes empty well-shaped planner state', () => {
    const result = evaluatePlannerSlo({
      plannedItems: [],
      blacklist: [],
      calendarExportableItems: [],
      invalidItems: [],
    });

    expect(result.passed).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it('warns when planned items exist but no calendarExportable', () => {
    const result = evaluatePlannerSlo({
      plannedItems: [{ title: 'Event' }],
      blacklist: [],
      calendarExportableItems: [],
      invalidItems: [{ item: { title: 'Event' }, validation: { valid: false } }],
    });

    expect(result.passed).toBe(true);
    expect(result.warnings).toContain('planner_no_calendar_exportable_items');
  });

  it('warns when blacklist exceeds 50', () => {
    const result = evaluatePlannerSlo({
      plannedItems: [],
      blacklist: Array.from({ length: 51 }, (_, i) => `item-${i}`),
      calendarExportableItems: [],
      invalidItems: [],
    });

    expect(result.passed).toBe(true);
    expect(result.warnings).toContain('planner_blacklist_unusually_large');
  });
});

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import {
  __upAheadViewModelInternalsForTest,
} from './useUpAheadTabViewModel.js';

const {
  normalizePlanDate,
  formatConciseDate,
  buildCardArticle,
  deriveVisibleState,
  hasVisibleUpAheadProjection,
  getModeFromEnvelope,
} = __upAheadViewModelInternalsForTest;

describe('useUpAheadTabViewModel static checks', () => {
  const src = fs.readFileSync('src/viewModels/useUpAheadTabViewModel.js', 'utf8');

  it('uses upAhead dataset', () => {
    expect(src).toContain("useDataset('upAhead')");
  });

  it('does not import Up Ahead services directly', () => {
    expect(src).not.toContain('fetchStaticUpAheadData');
    expect(src).not.toContain('fetchLiveUpAheadData');
    expect(src).not.toContain('mergeUpAheadData');
    expect(src).not.toContain('loadFromCache');
    expect(src).not.toContain('saveToCache');
    expect(src).not.toContain('clearUpAheadCache');
  });

  it('owns page projection, planner actions, and location actions', () => {
    expect(src).toContain('deriveVisibleState');
    expect(src).toContain('addToPlan');
    expect(src).toContain('removeFromPlan');
    expect(src).toContain('addLocation');
    expect(src).toContain('removeLocation');
  });

  it('guards planner actions with controlled result objects', () => {
    expect(src).toContain('try');
    expect(src).toContain('catch');
    expect(src).toContain('return { ok: true }');
    expect(src).toContain('return {');
    expect(src).toContain('ok: false');
  });
});

describe('Up Ahead ViewModel internals', () => {
  it('normalizes valid plan dates to local yyyy-mm-dd', () => {
    expect(normalizePlanDate('2026-05-28T10:00:00')).toBe('2026-05-28');
  });

  it('does not shift yyyy-mm-dd dates', () => {
    expect(normalizePlanDate('2026-05-28')).toBe('2026-05-28');
  });

  it('returns invalid plan date as-is', () => {
    expect(normalizePlanDate('not-a-date')).toBe('not-a-date');
  });

  it('formats concise dates', () => {
    expect(formatConciseDate('2026-05-28T10:00:00')).toContain('28');
  });

  it('builds card article safely', () => {
    const result = buildCardArticle({
      title: 'Event',
      date: '2026-05-28',
      platform: 'Cinema',
      description: 'Description',
    });

    expect(result.source).toBe('Cinema');
    expect(result.summary).toBe('Description');
    expect(result.time).toContain('28');
  });

  it('derives visible state from raw and projected data', () => {
    const result = deriveVisibleState({
      weatherAlerts: [{ title: 'Rain' }],
      offers: [{ title: 'Offer' }],
      releases: [{ title: 'Movie' }],
      festivals: [{ title: 'Festival' }],
      raw: {
        weekly_plan: [{ day: 'Today', items: [{ title: 'Plan' }] }],
        timeline: [{ date: '2026-05-28', items: [{ title: 'Timeline' }] }],
        sections: {
          events: [{ title: 'Event' }],
          civic: [{ title: 'Civic' }],
        },
      },
    });

    expect(result.weatherAlerts).toHaveLength(1);
    expect(result.offerItems).toHaveLength(1);
    expect(result.movieCards).toHaveLength(1);
    expect(result.festivalCards).toHaveLength(1);
    expect(result.weeklyPlan).toHaveLength(1);
    expect(result.timeline).toHaveLength(1);
  });

  it('supports top-level timeline and sections projection', () => {
    const result = deriveVisibleState({
      timeline: [{ date: '2026-05-28', items: [{ title: 'Timeline' }] }],
      sections: {
        events: [{ title: 'Event' }],
        civic: [{ title: 'Civic' }],
      },
    });

    expect(result.timeline).toHaveLength(1);
    expect(result.eventItems).toHaveLength(1);
    expect(result.civicAlerts).toHaveLength(1);
  });

  it('detects visible Up Ahead projection', () => {
    const visible = deriveVisibleState({
      raw: {
        weekly_plan: [{ day: 'Today', items: [{ title: 'Plan' }] }],
      },
    });

    expect(hasVisibleUpAheadProjection(visible)).toBe(true);
  });

  it('computes static snapshot mode', () => {
    const mode = getModeFromEnvelope({
      envelope: { source: 'snapshot' },
      data: { sourceMode: 'snapshot' },
      isStaticHost: true,
    });

    expect(mode.modeStr).toBe('snapshot');
    expect(mode.modeLabel).toBe('Snapshot');
  });

  it('maps cache source mode as cached', () => {
    const mode = getModeFromEnvelope({
      envelope: { source: 'cache' },
      data: { sourceMode: 'cache' },
      isStaticHost: true,
    });

    expect(mode.modeStr).toBe('cached');
    expect(mode.modeLabel).toBe('Cached');
  });

  it('maps failed source mode as error', () => {
    const mode = getModeFromEnvelope({
      envelope: { source: 'failed' },
      data: {},
      isStaticHost: false,
    });

    expect(mode.modeStr).toBe('error');
    expect(mode.modeLabel).toBe('Failed');
  });
});

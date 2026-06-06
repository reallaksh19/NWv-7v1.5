import { describe, expect, it } from 'vitest';
import { __dataStateBoundaryInternalsForTest } from './DataStateBoundary.internals.js';

const {
  getBoundaryState,
  hasRenderableData,
} = __dataStateBoundaryInternalsForTest;

describe('DataStateBoundary internals', () => {
  it('returns loading when loading without envelope', () => {
    expect(getBoundaryState({
      loading: true,
    })).toBe('loading');
  });

  it('returns error when error exists without envelope', () => {
    expect(getBoundaryState({
      error: 'failed',
    })).toBe('error');
  });

  it('returns empty when no envelope exists', () => {
    expect(getBoundaryState({})).toBe('empty');
  });

  it('returns degraded for failed envelope with renderable data when allowed', () => {
    expect(getBoundaryState({
      envelope: {
        ok: false,
        data: {
          frontPage: [{ title: 'A' }],
        },
      },
      allowDegraded: true,
    })).toBe('degraded');
  });

  it('returns error for failed envelope with no renderable data', () => {
    expect(getBoundaryState({
      envelope: {
        ok: false,
        data: {
          frontPage: [],
          sections: {},
        },
      },
      allowDegraded: true,
    })).toBe('error');
  });

  it('returns refreshing when loading with renderable envelope', () => {
    expect(getBoundaryState({
      loading: true,
      envelope: {
        ok: true,
        freshness: 'fresh',
        data: {
          frontPage: [{ title: 'A' }],
        },
      },
      allowDegraded: true,
    })).toBe('refreshing');
  });

  it('returns ready for renderable ok envelope', () => {
    expect(getBoundaryState({
      envelope: {
        ok: true,
        freshness: 'fresh',
        data: {
          frontPage: [{ title: 'A' }],
        },
      },
      allowDegraded: true,
    })).toBe('ready');
  });

  it('does not treat structured empty object as renderable', () => {
    expect(hasRenderableData({
      data: {
        frontPage: [],
        sections: {},
        metrics: { count: 0 },
      },
    })).toBe(false);
  });

  it('treats object with visible article array as renderable', () => {
    expect(hasRenderableData({
      data: {
        frontPage: [{ title: 'A' }],
        metrics: { count: 1 },
      },
    })).toBe(true);
  });
});

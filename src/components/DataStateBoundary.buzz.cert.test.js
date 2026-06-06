import { describe, expect, it } from 'vitest';
import { __dataStateBoundaryInternalsForTest } from './DataStateBoundary.internals.js';

const { getBoundaryState } = __dataStateBoundaryInternalsForTest;

// Mirrors the Buzz Hub fix: the page synthesizes a "ready" envelope from
// displayData (NewsContext/cache) so it is not blanked just because the buzz
// dataset envelope came back empty.
describe('DataStateBoundary — Buzz synthesized envelope renders when content exists', () => {
  it('renders (ready) when a synthesized envelope carries display content', () => {
    const synthesized = {
      ok: true,
      freshness: 'fresh',
      error: null,
      data: { technology: [{ title: 'Pixel 11 leak' }], entertainment: [], social: [] },
    };
    const state = getBoundaryState({
      envelope: synthesized,
      loading: false,
      error: null,
      allowDegraded: true,
      treatEmptyAsReady: false,
    });
    expect(state).toBe('ready');
  });

  it('still shows empty when there is genuinely no content anywhere', () => {
    const emptyEnvelope = {
      ok: true,
      freshness: 'empty',
      error: null,
      data: { technology: [], entertainment: [], social: [] },
    };
    const state = getBoundaryState({
      envelope: emptyEnvelope,
      loading: false,
      error: null,
      allowDegraded: true,
      treatEmptyAsReady: false,
    });
    expect(state).toBe('empty');
  });
});

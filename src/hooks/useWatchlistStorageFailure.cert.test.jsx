// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWatchlist } from './useWatchlist.js';

function failLocalStorageWrites() {
  return vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Quota exceeded', 'QuotaExceededError');
  });
}

describe('useWatchlist storage failures', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('keeps watchlist state unchanged and returns a visible failure on quota errors', () => {
    failLocalStorageWrites();

    const { result } = renderHook(() => useWatchlist('quota-watchlist'));
    let outcome;

    act(() => {
      outcome = result.current.toggleWatchlist('story-1');
    });

    expect(outcome).toMatchObject({
      ok: false,
      reason: 'storage-write-failed',
    });
    expect(outcome.error).toContain('Storage is full');
    expect(result.current.watchlist).toEqual([]);
    expect(result.current.watchlistError).toContain('Storage is full');
    expect(localStorage.getItem('quota-watchlist')).toBe(null);
  });
});

// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getSafeLocalStorage,
  safeGetJson,
  safeRemove,
  safeSetJson,
} from './safeStorage.js';

describe('safeStorage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('getSafeLocalStorage returns localStorage when available', () => {
    expect(getSafeLocalStorage()).toBe(window.localStorage);
  });

  it('safeGetJson returns fallback on missing key', () => {
    expect(safeGetJson('missing-key', { fallback: true })).toEqual({ fallback: true });
  });

  it('safeGetJson returns fallback on invalid JSON', () => {
    window.localStorage.setItem('bad-json', '{bad');

    expect(safeGetJson('bad-json', { fallback: true })).toEqual({ fallback: true });
  });

  it('safeSetJson returns true on success', () => {
    expect(safeSetJson('ok-json', { a: 1 })).toBe(true);
    expect(JSON.parse(window.localStorage.getItem('ok-json'))).toEqual({ a: 1 });
  });

  it('safeSetJson returns false when storage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    expect(safeSetJson('bad-write', { a: 1 })).toBe(false);

    spy.mockRestore();
  });

  it('safeRemove returns false when storage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('remove failed');
    });

    expect(safeRemove('bad-remove')).toBe(false);

    spy.mockRestore();
  });

  it('getSafeLocalStorage returns null if accessing localStorage throws', () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');

    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });

    expect(getSafeLocalStorage()).toBe(null);
    expect(safeGetJson('x', 'fallback')).toBe('fallback');
    expect(safeSetJson('x', { a: 1 })).toBe(false);
    expect(safeRemove('x')).toBe(false);

    Object.defineProperty(window, 'localStorage', descriptor);
  });
});

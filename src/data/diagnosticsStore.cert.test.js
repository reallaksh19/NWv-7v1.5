import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearDiagnostics,
  listDiagnostics,
  recordDiagnostic,
  subscribeDiagnostics,
  __getMaxDiagnosticsForTest,
} from './diagnosticsStore.js';

describe('diagnosticsStore', () => {
  beforeEach(() => {
    clearDiagnostics();
    vi.restoreAllMocks();
  });

  it('recordDiagnostic stores a normalized event and returns it', () => {
    const result = recordDiagnostic({
      datasetId: 'market',
      severity: 'info',
      event: 'market_loaded',
      message: 'ok',
    });

    expect(result.id).toBeTruthy();
    expect(result.ts).toBeTypeOf('number');
    expect(result.severity).toBe('info');
    expect(result.datasetId).toBe('market');
    expect(result.event).toBe('market_loaded');
    expect(result.message).toBe('ok');

    const list = listDiagnostics();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(result.id);
  });

  it('listDiagnostics returns a copy — mutations do not affect the store', () => {
    recordDiagnostic({ event: 'test' });
    const a = listDiagnostics();
    a.push({ fake: true });
    const b = listDiagnostics();
    expect(b).toHaveLength(1);
  });

  it('clearDiagnostics empties the store', () => {
    recordDiagnostic({ event: 'test' });
    clearDiagnostics();
    expect(listDiagnostics()).toHaveLength(0);
  });

  it('subscribeDiagnostics fires on record and on clear', () => {
    const listener = vi.fn();
    const unsub = subscribeDiagnostics(listener);

    recordDiagnostic({ event: 'a' });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toHaveLength(1);

    clearDiagnostics();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[1][0]).toHaveLength(0);

    unsub();
  });

  it('unsubscribe stops future notifications', () => {
    const listener = vi.fn();
    const unsub = subscribeDiagnostics(listener);
    unsub();

    recordDiagnostic({ event: 'after-unsub' });
    expect(listener).not.toHaveBeenCalled();
  });

  it('subscribeDiagnostics is a no-op for non-function', () => {
    expect(() => {
      const unsub = subscribeDiagnostics('not a function');
      unsub();
    }).not.toThrow();

    recordDiagnostic({ event: 'fine' });
    expect(listDiagnostics()).toHaveLength(1);
  });

  it('ring buffer: oldest events are dropped when MAX_DIAGNOSTICS is exceeded', () => {
    const MAX = __getMaxDiagnosticsForTest();

    for (let i = 0; i < MAX + 10; i++) {
      recordDiagnostic({ event: `evt-${i}`, message: String(i) });
    }

    const list = listDiagnostics();
    expect(list).toHaveLength(MAX);
    expect(list[0].message).toBe(String(10));
    expect(list[MAX - 1].message).toBe(String(MAX + 9));
  });

  it('defaults severity to info and datasetId to unknown when omitted', () => {
    const result = recordDiagnostic({ event: 'bare' });
    expect(result.severity).toBe('info');
    expect(result.datasetId).toBe('unknown');
  });
});

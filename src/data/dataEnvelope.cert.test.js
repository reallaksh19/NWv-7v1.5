import { describe, it, expect } from 'vitest';
import {
  ENVELOPE_SOURCES,
  makeEnvelope,
  isUsableEnvelope,
  stableStringify,
  fnv1aHex,
} from './dataEnvelope.js';

describe('dataEnvelope', () => {
  it('creates a frozen default envelope', () => {
    const env = makeEnvelope({
      datasetId: 'test',
      data: { a: 1 },
    });

    expect(Object.isFrozen(env)).toBe(true);
    expect(env.ok).toBe(true);
    expect(env.datasetId).toBe('test');
    expect(env.source).toBe('live');
    expect(env.fallbackUsed).toBe(false);
  });

  it('marks fallbackUsed when source is not live', () => {
    const snapshot = makeEnvelope({ source: ENVELOPE_SOURCES.SNAPSHOT, data: [] });
    const cache = makeEnvelope({ source: ENVELOPE_SOURCES.CACHE, data: [] });
    const seed = makeEnvelope({ source: ENVELOPE_SOURCES.SEED, data: [] });
    const failed = makeEnvelope({ ok: false, source: ENVELOPE_SOURCES.FAILED, data: [] });

    expect(snapshot.fallbackUsed).toBe(true);
    expect(cache.fallbackUsed).toBe(true);
    expect(seed.fallbackUsed).toBe(true);
    expect(failed.fallbackUsed).toBe(true);
  });

  it('uses null lastGoodAt for failed envelopes unless supplied', () => {
    const env = makeEnvelope({
      ok: false,
      source: ENVELOPE_SOURCES.FAILED,
      data: [],
    });

    expect(env.lastGoodAt).toBe(null);
  });

  it('hashes objects by stable key order', () => {
    const a = makeEnvelope({ data: { a: 1, b: 2 } });
    const b = makeEnvelope({ data: { b: 2, a: 1 } });

    expect(a.payloadHash).toBe(b.payloadHash);
  });

  it('changes payloadHash when data changes', () => {
    const a = makeEnvelope({ data: { a: 1, b: 2 } });
    const b = makeEnvelope({ data: { a: 1, b: 3 } });

    expect(a.payloadHash).not.toBe(b.payloadHash);
  });

  it('stableStringify recursively sorts object keys', () => {
    expect(stableStringify({ z: 1, a: { y: 2, b: 3 } }))
      .toBe(stableStringify({ a: { b: 3, y: 2 }, z: 1 }));
  });

  it('fnv1aHex returns stable 8-char hex', () => {
    const hash = fnv1aHex('abc');

    expect(hash).toMatch(/^[0-9a-f]{8}$/);
    expect(hash).toBe(fnv1aHex('abc'));
  });

  it('isUsableEnvelope returns true only for ok true and non-null data', () => {
    expect(isUsableEnvelope(makeEnvelope({ ok: true, data: [] }))).toBe(true);
    expect(isUsableEnvelope(makeEnvelope({ ok: true, data: null }))).toBe(false);
    expect(isUsableEnvelope(makeEnvelope({ ok: false, data: [] }))).toBe(false);
    expect(isUsableEnvelope(null)).toBe(false);
  });
});

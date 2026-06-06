import { beforeEach, describe, expect, it, vi } from 'vitest';
import { load, __sourceHealthInternalsForTest } from './sourceHealthDataset.js';

const { normalizeSourceHealth } = __sourceHealthInternalsForTest;

function makeOkFetch(data) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ generatedAt: Date.now(), ...data }),
  }));
}

function makeFailFetch() {
  return vi.fn(async () => ({
    ok: false,
    status: 404,
    json: async () => ({}),
  }));
}

describe('sourceHealthDataset', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns frozen envelope with datasetId sourceHealth', async () => {
    vi.stubGlobal('fetch', makeOkFetch({
      sources: [{ id: 'bbc', status: 'ok', itemCount: 50 }],
    }));
    const env = await load();
    expect(Object.isFrozen(env)).toBe(true);
    expect(env.datasetId).toBe('sourceHealth');
  });

  it('ok:true with normalized sources when Schema A (object keyed) is returned', async () => {
    vi.stubGlobal('fetch', makeOkFetch({
      sourceHealth: {
        bbc: { status: 'ok', itemCount: 10 },
        cnn: { status: 'warn', itemCount: 0 },
      },
    }));
    const env = await load();
    expect(env.ok).toBe(true);
    expect(env.data.sources).toHaveLength(2);
    const ids = env.data.sources.map(s => s.id);
    expect(ids).toContain('bbc');
    expect(ids).toContain('cnn');
  });

  it('ok:true with normalized sources when Schema B (array) is returned', async () => {
    vi.stubGlobal('fetch', makeOkFetch({
      sources: [
        { id: 'reuters', status: 'ok', itemCount: 30 },
        { id: 'ap', status: 'ok', itemCount: 20 },
      ],
    }));
    const env = await load();
    expect(env.ok).toBe(true);
    expect(env.data.sources).toHaveLength(2);
  });

  it('ok:false when all candidate paths fail', async () => {
    vi.stubGlobal('fetch', makeFailFetch());
    const env = await load();
    expect(env.ok).toBe(false);
    expect(env.validation.errors).toContain('source health unavailable');
    expect(env.data.sources).toHaveLength(0);
  });

  it('diagnostics include source_health_unavailable when all fail', async () => {
    vi.stubGlobal('fetch', makeFailFetch());
    const env = await load();
    const events = env.diagnostics.map(d => d.event);
    expect(events).toContain('source_health_unavailable');
  });

  it('diagnostics include source_health_loaded on success', async () => {
    vi.stubGlobal('fetch', makeOkFetch({
      sources: [{ id: 'bbc', status: 'ok', itemCount: 5 }],
    }));
    const env = await load();
    const events = env.diagnostics.map(d => d.event);
    expect(events).toContain('source_health_loaded');
  });
});

describe('normalizeSourceHealth internals', () => {
  it('handles null/undefined gracefully', () => {
    expect(normalizeSourceHealth(null).sources).toHaveLength(0);
    expect(normalizeSourceHealth(undefined).sources).toHaveLength(0);
    expect(normalizeSourceHealth({}).sources).toHaveLength(0);
  });

  it('normalizes sources to consistent shape', () => {
    const result = normalizeSourceHealth({
      sources: [
        { id: 'bbc', name: 'BBC', status: 'ok', itemCount: 10 },
      ],
    });
    const s = result.sources[0];
    expect(s.id).toBe('bbc');
    expect(s.name).toBe('BBC');
    expect(s.status).toBe('ok');
    expect(s.itemCount).toBe(10);
    expect(typeof s.severity).toBe('string');
  });

  it('falls back to source-N id when id field missing', () => {
    const result = normalizeSourceHealth({
      sources: [{ status: 'ok', itemCount: 1 }],
    });
    expect(result.sources[0].id).toMatch(/source-0/);
  });
});

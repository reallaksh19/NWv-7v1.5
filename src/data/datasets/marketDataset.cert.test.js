import { beforeEach, describe, expect, it, vi } from 'vitest';
import { load } from './marketDataset.js';

vi.mock('../../services/indianMarketStableService.js', () => ({
  fetchAllMarketData: vi.fn(),
}));

import { fetchAllMarketData } from '../../services/indianMarketStableService.js';

const MARKET_DATA_OK = {
  indices: [
    { name: 'SENSEX', value: 75000 },
    { name: 'NIFTY', value: 22000 },
  ],
  fetchedAt: Date.now(),
  sourceMode: 'live',
};

describe('marketDataset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns frozen envelope with datasetId market', async () => {
    fetchAllMarketData.mockResolvedValue(MARKET_DATA_OK);
    const env = await load();
    expect(Object.isFrozen(env)).toBe(true);
    expect(env.datasetId).toBe('market');
  });

  it('ok:true when indices array is non-empty', async () => {
    fetchAllMarketData.mockResolvedValue(MARKET_DATA_OK);
    const env = await load();
    expect(env.ok).toBe(true);
    expect(env.validation.passed).toBe(true);
    expect(env.validation.errors).toHaveLength(0);
  });

  it('ok:false when indices is empty', async () => {
    fetchAllMarketData.mockResolvedValue({ ...MARKET_DATA_OK, indices: [] });
    const env = await load();
    expect(env.ok).toBe(false);
    expect(env.validation.errors).toContain('market_indices_empty');
  });

  it('ok:false when indices is missing', async () => {
    fetchAllMarketData.mockResolvedValue({ fetchedAt: Date.now() });
    const env = await load();
    expect(env.ok).toBe(false);
  });

  it('ok:false when service throws', async () => {
    fetchAllMarketData.mockRejectedValue(new Error('service down'));
    const env = await load();
    expect(env.ok).toBe(false);
    expect(env.error).toContain('service down');
    expect(env.source).toBe('failed');
  });

  it('source is live for live sourceMode', async () => {
    fetchAllMarketData.mockResolvedValue({ ...MARKET_DATA_OK, sourceMode: 'live' });
    const env = await load();
    expect(env.source).toBe('live');
  });

  it('source is snapshot for snapshot sourceMode', async () => {
    fetchAllMarketData.mockResolvedValue({ ...MARKET_DATA_OK, sourceMode: 'snapshot' });
    const env = await load();
    expect(env.source).toBe('snapshot');
  });

  it('source is cache for cache sourceMode', async () => {
    fetchAllMarketData.mockResolvedValue({ ...MARKET_DATA_OK, sourceMode: 'cache' });
    const env = await load();
    expect(env.source).toBe('cache');
  });

  it('source is seed for seed sourceMode', async () => {
    fetchAllMarketData.mockResolvedValue({ ...MARKET_DATA_OK, sourceMode: 'seed' });
    const env = await load();
    expect(env.source).toBe('seed');
  });

  it('payloadHash is deterministic regardless of key order', async () => {
    const dataA = { indices: [{ name: 'X', value: 1 }], fetchedAt: 1000, sourceMode: 'live' };
    const dataB = { sourceMode: 'live', fetchedAt: 1000, indices: [{ name: 'X', value: 1 }] };

    fetchAllMarketData.mockResolvedValueOnce(dataA);
    const envA = await load();

    fetchAllMarketData.mockResolvedValueOnce(dataB);
    const envB = await load();

    expect(envA.payloadHash).toBe(envB.payloadHash);
  });

  it('payloadHash changes when data changes', async () => {
    fetchAllMarketData.mockResolvedValueOnce(MARKET_DATA_OK);
    const envA = await load();

    fetchAllMarketData.mockResolvedValueOnce({
      ...MARKET_DATA_OK,
      indices: [{ name: 'SENSEX', value: 99999 }],
    });
    const envB = await load();

    expect(envA.payloadHash).not.toBe(envB.payloadHash);
  });

  it('diagnostics contains the load event', async () => {
    fetchAllMarketData.mockResolvedValue(MARKET_DATA_OK);
    const env = await load();
    const events = env.diagnostics.map(d => d.event);
    expect(events.some(e => e.includes('market_dataset'))).toBe(true);
  });
});

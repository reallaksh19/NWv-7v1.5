import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchIPOData, fetchMutualFunds } from './indianMarketStableService.js';

function mockJsonResponse(payload, ok = true) {
  return Promise.resolve({
    ok,
    json: () => Promise.resolve(payload),
  });
}

describe('Indian market stable sidecar feeds', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads official mutual fund NAV sidecar rows when the market snapshot is expired', async () => {
    vi.stubGlobal('fetch', vi.fn(() => mockJsonResponse({
      generatedAt: new Date().toISOString(),
      mutualFunds: [
        {
          schemeCode: '119550',
          name: 'Aditya Birla Sun Life Banking & PSU Debt Fund',
          category: 'Aditya Birla Sun Life Mutual Fund',
          nav: '394.7547',
          navDate: '26-May-2026',
        },
      ],
    })));

    const funds = await fetchMutualFunds();

    expect(funds).toHaveLength(1);
    expect(funds[0]).toMatchObject({
      code: '119550',
      name: 'Aditya Birla Sun Life Banking & PSU Debt Fund',
      nav: 394.7547,
      direction: 'neutral',
      sourceMode: 'official-daily',
    });
  });

  it('rejects stale mutual fund sidecar rows instead of reviving expired data', async () => {
    vi.stubGlobal('fetch', vi.fn(() => mockJsonResponse({
      generatedAt: '2026-01-01T00:00:00Z',
      mutualFunds: [
        { schemeCode: 'old', name: 'Old Fund', nav: 1 },
      ],
    })));

    await expect(fetchMutualFunds()).resolves.toEqual([]);
  });

  it('returns an empty IPO calendar when the snapshot has no calendar rows', async () => {
    vi.stubGlobal('fetch', vi.fn(() => mockJsonResponse({
      generatedAt: new Date().toISOString(),
      ipo: { upcoming: [], live: [], recent: [] },
    })));

    await expect(fetchIPOData()).resolves.toEqual({ upcoming: [], live: [], recent: [] });
  });
});

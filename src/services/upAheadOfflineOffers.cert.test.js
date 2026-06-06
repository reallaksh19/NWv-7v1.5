import { describe, expect, it } from 'vitest';
import { sanitizeUpAheadData } from './upAheadService.js';
import { __upAheadPageViewModelInternalsForTest } from '../viewModels/useUpAheadPageViewModel.js';

const { getVisibleUpAheadProjection } = __upAheadPageViewModelInternalsForTest;

const NOW = Date.now();

function shoppingItem(i, { city = null } = {}) {
  return {
    id: `s${i}${city || 'na'}`,
    title: city
      ? `${city} mall weekend sale up to 50% off (${i})`
      : `Amazon national mega sale ${i} — up to 70% off`,
    summary: 'offer discount sale',
    url: `https://example.com/${city || 'na'}/${i}`,
    source: 'Google News',
    category: 'shopping',
    publishedAt: NOW - 60 * 60 * 1000,
    city,
  };
}

describe('UpAhead offline offers survive the section cap (located items reserved)', () => {
  it('keeps local city offers even when national offers would otherwise fill every slot', () => {
    // 30 city-agnostic national offers listed FIRST (as in the real snapshot),
    // then a handful of local ones. The old 20-cap evicted every local offer.
    const items = [
      ...Array.from({ length: 30 }, (_, i) => shoppingItem(i)),
      shoppingItem(100, { city: 'Chennai' }),
      shoppingItem(101, { city: 'Chennai' }),
      shoppingItem(102, { city: 'Muscat' }),
    ];

    const sanitized = sanitizeUpAheadData({ schemaVersion: 1, items });
    const result = getVisibleUpAheadProjection({
      data: sanitized,
      settings: { upAhead: { locations: ['Chennai', 'Muscat'] } },
    });

    expect(result.offlineOffers.length).toBeGreaterThanOrEqual(3);
    expect(result.offlineOffers.some(o => o.city === 'Chennai')).toBe(true);
    expect(result.offlineOffers.some(o => o.city === 'Muscat')).toBe(true);
    // Online offers still present too.
    expect(result.onlineOffers.length).toBeGreaterThan(0);
  });
});

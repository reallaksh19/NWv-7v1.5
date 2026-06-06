import { describe, expect, it } from 'vitest';
import { __upAheadPageViewModelInternalsForTest } from './useUpAheadPageViewModel.js';

const { buildSuggestedItems, getVisibleUpAheadProjection } = __upAheadPageViewModelInternalsForTest;

const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;

describe('UpAhead Suggested feed (automatic, cross-category)', () => {
  it('combines releases/events/festivals/offers/civic and ranks soonest-upcoming first', () => {
    const suggested = buildSuggestedItems({
      movieCards: [{ id: 'm1', title: 'Big release', releaseDate: new Date(NOW + 2 * DAY).toISOString() }],
      eventItems: [{ id: 'e1', title: 'Concert', date: new Date(NOW + 1 * DAY).toISOString().slice(0, 10) }],
      festivalCards: [{ id: 'f1', title: 'Festival', date: new Date(NOW + 5 * DAY).toISOString().slice(0, 10) }],
      onlineOffers: [{ id: 'o1', title: 'Prime Day deal', publishedAt: NOW - 60 * 60 * 1000 }],
      offlineOffers: [{ id: 'l1', title: 'Local mall sale', city: 'Chennai', publishedAt: NOW - 30 * 60 * 1000 }],
      civicAlerts: [{ id: 'c1', title: 'Water supply notice', publishedAt: NOW - 2 * 60 * 60 * 1000 }],
    });

    // All categories represented.
    expect(suggested.length).toBe(6);
    // Offers carry the offer flag for the renderer.
    expect(suggested.find(i => i.id === 'o1').isOffer).toBe(true);
    // The soonest upcoming dated item (concert, +1d) ranks above the later ones.
    const ids = suggested.map(i => i.id);
    expect(ids.indexOf('e1')).toBeLessThan(ids.indexOf('f1'));
  });

  it('dedupes by id/link/title and caps the list', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ id: `e${i}`, title: `Event ${i}`, publishedAt: NOW - i * 1000 }));
    const suggested = buildSuggestedItems({ eventItems: [...many, { id: 'e0', title: 'Event 0 dup' }] });
    expect(suggested.length).toBeLessThanOrEqual(24);
    expect(suggested.filter(i => i.id === 'e0')).toHaveLength(1);
  });

  it('is exposed on the projection as suggestedItems', () => {
    const data = {
      sections: {
        events: [{ id: 'e1', title: 'Chennai concert this week', date: new Date(NOW + DAY).toISOString().slice(0, 10) }],
        movies: [{ id: 'm1', title: 'New OTT release', releaseDate: new Date(NOW + 2 * DAY).toISOString() }],
      },
    };
    const result = getVisibleUpAheadProjection({ data, settings: {} });
    expect(Array.isArray(result.suggestedItems)).toBe(true);
    expect(result.suggestedItems.length).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from 'vitest';
import { __upAheadPageViewModelInternalsForTest } from './useUpAheadPageViewModel.js';

const { getVisibleUpAheadProjection } = __upAheadPageViewModelInternalsForTest;

const NOW = Date.now();

function offer(id, title, source) {
  return {
    id,
    title,
    description: title,
    source,
    section: 'shopping',
    category: 'shopping',
    publishedAt: NOW - 60 * 60 * 1000,
  };
}

describe('UpAhead online offers — de-duplicate & group (Prime Day)', () => {
  it('collapses near-duplicate Prime Day offers into one representative with a sourceCount', () => {
    const data = {
      sections: {
        shopping: [
          offer('a', 'Amazon Prime Day 2026: When You Can Start Shopping, Early Deals and More', 'TODAY.com'),
          offer('b', 'Amazon Prime Day 2026 dates revealed for summer sale', 'Cincinnati Enquirer'),
          offer('c', 'Amazon Prime Day 2026 will run for four days and include major tech discounts', 'SFGATE'),
          offer('d', 'Amazon Prime Day 2026 is in June — early deals up to 73% off', 'People.com'),
          // An unrelated offer that must remain separate.
          offer('e', 'Flipkart Big Billion Days 2026 sale: up to 80% off announced', 'LiveMint'),
        ],
      },
    };

    const result = getVisibleUpAheadProjection({ data, settings: {} });

    // The four Prime Day write-ups collapse; Flipkart stays on its own.
    expect(result.onlineOffers.length).toBeLessThan(5);
    expect(result.onlineOffers.some(o => /flipkart/i.test(o.title))).toBe(true);

    const primeDay = result.onlineOffers.find(o => /prime day/i.test(o.title));
    expect(primeDay).toBeTruthy();
    // The grouped representative aggregates multiple sources.
    expect(primeDay.sourceCount).toBeGreaterThan(1);
  });

  it('leaves a single distinct offer untouched (sourceCount 1)', () => {
    const data = {
      sections: {
        shopping: [offer('only', 'Myntra End of Season Sale flat 50-70% off', 'Myntra')],
      },
    };
    const result = getVisibleUpAheadProjection({ data, settings: {} });
    expect(result.onlineOffers).toHaveLength(1);
    // A lone offer is not grouped, so it is never marked as multi-source.
    expect(result.onlineOffers[0].sourceCount || 1).toBe(1);
    expect(result.onlineOffers[0].groupedCount).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, InsightParent, InsightStory } from '../types';
import { computeInformationGain } from './treeBuilder';

function story(id: string, numbers: string[], embedding: number[]): InsightStory {
  return {
    id,
    title: `${id} headline`,
    summary: 'A compact certification summary with updated facts.',
    source: 'Source A',
    sourceGroup: 'source-a',
    url: `https://example.com/${id}`,
    publishedAt: Date.parse('2026-05-30T00:00:00Z'),
    category: 'news',
    region: 'IN',
    language: 'en',
    capturedAtSnapshot: 'now',
    canonicalUrl: `https://example.com/${id}`,
    canonicalText: `${id} headline summary`,
    canonicalTextHash: id,
    entities: {
      people: [],
      orgs: ['Org'],
      places: ['India'],
      products: [],
      symbols: [],
    },
    keywords: [],
    embedding,
    eventVerbs: ['said'],
    numbers,
    sourceTier: 'A',
    sourceAuthority: 0.8,
    freshnessScore: 0.8,
    rawProminence: 0.8,
    sentiment: 0,
    factualDensity: 0.8,
    summaryQuality: 0.8,
    angle: 'fact_update',
  };
}

describe('tree builder information gain certification', () => {
  it('admits same-source fact updates at the 0.10 threshold', () => {
    const parent = {} as InsightParent;
    const selected = [story('base-update', ['4'], [0, 1, 0])];
    const candidate = story('new-count', ['5'], [1, 0, 0]);

    const gain = computeInformationGain(candidate, selected, parent);

    expect(DEFAULT_CONFIG.MIN_CHILD_INFO_GAIN).toBe(0.10);
    expect(gain).toBe(0.10);
    expect(gain).toBeGreaterThanOrEqual(DEFAULT_CONFIG.MIN_CHILD_INFO_GAIN);
  });
});

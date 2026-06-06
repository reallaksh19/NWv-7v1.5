import { describe, expect, it } from 'vitest';
import { classifyAngle } from './dedup';
import type { InsightStory } from '../types';

function story(title: string, summary: string): InsightStory {
  return {
    id: title.toLowerCase().replace(/\W+/g, '-'),
    title,
    summary,
    source: 'Source A',
    sourceGroup: 'source-a',
    url: 'https://example.com/story',
    publishedAt: Date.now(),
    category: 'news',
    region: 'IN',
    language: 'en',

    capturedAtSnapshot: 'now',
    canonicalUrl: 'https://example.com/story',
    canonicalText: `${title} ${summary}`,
    canonicalTextHash: title,

    entities: {
      people: [],
      orgs: ['Org'],
      places: ['India'],
      products: [],
      symbols: [],
    },

    keywords: [],
    embedding: [1, 0, 0],
    eventVerbs: ['said'],
    numbers: [],

    sourceTier: 'A',
    sourceAuthority: 0.8,
    freshnessScore: 0.8,
    rawProminence: 0.8,
    sentiment: 0,
    factualDensity: 0.8,
    summaryQuality: 0.8,
  };
}

describe('Insight angle classifier enrichment certification', () => {
  it('classifies public reaction stories', () => {
    const s = story(
      'Public backlash grows after new policy',
      'Residents said the move triggered social media criticism and protests.'
    );

    expect(classifyAngle(s)).toBe('reaction_public');
  });

  it('classifies background context stories', () => {
    const s = story(
      'Explainer: timeline of the court case',
      'Here is the background and key points that led to the decision.'
    );

    expect(classifyAngle(s)).toBe('background_context');
  });

  it('classifies official response with strengthened official signals', () => {
    const s = story(
      'Authorities said rescue work is continuing',
      'Officials said teams remain at the site and according to the ministry more updates will follow.'
    );

    expect(classifyAngle(s)).toBe('official_response');
  });

  it('classifies official bureau statement as official_response at the softer threshold', () => {
    const s = story(
      'Oman government said new infrastructure plan announced',
      'The official statement followed a briefing, according to the ministry.'
    );

    expect(classifyAngle(s)).toBe('official_response');
  });

  it('classifies expert commentary as expert_analysis', () => {
    const s = story(
      'Analysts warn India inflation may hit 6% next quarter',
      'Economists note the policy implications for household budgets.'
    );

    expect(classifyAngle(s)).toBe('expert_analysis');
  });

  it('classifies casualty count headlines as fact_update', () => {
    const s = story(
      '2 Children Among 4 Killed After Train Hits School Bus',
      'Officials said the updated count was released after rescue work.'
    );

    expect(classifyAngle(s)).toBe('fact_update');
  });

  it('does not let collector base_report hints suppress stronger runtime signals', () => {
    const s = {
      ...story(
        'PM Modi urges citizens to take precautions amid heatwave',
        'The prime minister asked ministries to coordinate the official response.'
      ),
      angleHints: [{ angle: 'base_report', score: 0.95 }],
    } as InsightStory & { angleHints: Array<{ angle: string; score: number }> };

    expect(classifyAngle(s)).toBe('official_response');
  });

  it('keeps correction higher priority than fact update', () => {
    const s = story(
      'Correction: latest figures updated',
      'Editors clarified the latest figures after corrected data was issued.'
    );

    expect(classifyAngle(s)).toBe('correction');
  });

  it('derives angle from evolution role only when keyword classification falls back', () => {
    const s = {
      ...story(
        'Company opens new office',
        'The announcement was made on Monday with general details.'
      ),
      evolutionRole: 'market_reaction',
      evolutionRoleConfidence: 0.68,
    } as InsightStory;

    expect(classifyAngle(s)).toBe('market_reaction');
    expect((s as any).angleReason).toBe('evolution role fallback: market_reaction');
  });

  it('does not let evolution role override a specific keyword angle', () => {
    const s = {
      ...story(
        'Authorities said rescue work is continuing',
        'Officials said the ministry will issue another statement.'
      ),
      evolutionRole: 'market_reaction',
      evolutionRoleConfidence: 0.68,
    } as InsightStory;

    expect(classifyAngle(s)).toBe('official_response');
    expect((s as any).angleReason).not.toBe('evolution role fallback: market_reaction');
  });

  it('classifies base report when no specific angle signal exists', () => {
    const s = story(
      'Company announces new office opening',
      'The announcement was made on Monday with general details.'
    );

    expect(classifyAngle(s)).toBe('base_report');
  });
});

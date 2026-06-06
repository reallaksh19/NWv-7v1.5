import { describe, expect, it } from 'vitest';
import { computeImpactScore } from './rssAggregator.js';

const base = (title, description = '') => ({
  id: title,
  title,
  description,
  publishedAt: Date.now() - 30 * 60 * 1000, // 30 min ago (very fresh)
  source: 'BBC',
});

describe('computeImpactScore — headline regression (RC-1/RC-3/RC-4 fix)', () => {
  it('a casualty war story outranks a same-age game trailer', () => {
    const warScore = computeImpactScore(
      base('Iran missile strike kills dozens in Gulf', 'West Asia war ongoing'),
      'world',
      0,
      { enableNewScoring: true, rankingMode: 'smart' },
    );
    const gameScore = computeImpactScore(
      base('God of War Laufey gameplay trailer revealed', 'Revealed at State of Play'),
      'technology',
      0,
      { enableNewScoring: true, rankingMode: 'smart' },
    );
    expect(warScore).toBeGreaterThan(gameScore);
  });

  it('a guarded entertainment-section game reveal does NOT get the entertainment boost (RC-1 follow-up)', () => {
    // Even in the entertainment section and with the entertainment boost turned
    // way up, a guarded promo must not outrank hard news in the cross-section feed.
    const settings = {
      enableNewScoring: true,
      rankingMode: 'smart',
      rankingWeights: { temporal: { entertainmentBoost: 2.5 } },
    };
    const guarded = { id: 'g', title: 'God of War Laufey gameplay trailer revealed', description: 'State of Play reveal', publishedAt: Date.now() - 30 * 60 * 1000, source: 'IGN', section: 'entertainment' };
    const warItem = base('Iran missile strike kills dozens in Gulf', 'West Asia war ongoing');

    const guardedScore = computeImpactScore(guarded, 'entertainment', 0, settings);
    const warScore = computeImpactScore(warItem, 'world', 0, settings);

    expect(warScore).toBeGreaterThan(guardedScore);
    expect((guarded._rankDecisions || []).some(d => /entertainment temporal boost suppressed/.test(d))).toBe(true);
  });

  it('a genuine entertainment news item (not guarded) still receives the entertainment boost', () => {
    const settings = {
      enableNewScoring: true,
      rankingMode: 'smart',
      rankingWeights: { temporal: { entertainmentBoost: 2.5 } },
    };
    const realEntNews = { id: 'e', title: 'Film studio files for bankruptcy after box office collapse', description: '', publishedAt: Date.now() - 30 * 60 * 1000, source: 'Variety', section: 'entertainment' };
    computeImpactScore(realEntNews, 'entertainment', 0, settings);
    // "box office" IS in the guard list, so this would be suppressed — use a clean non-guarded headline instead:
    const clean = { id: 'e2', title: 'Veteran actor honoured with lifetime achievement award', description: '', publishedAt: Date.now() - 30 * 60 * 1000, source: 'Variety', section: 'entertainment' };
    computeImpactScore(clean, 'entertainment', 0, settings);
    expect((clean._rankDecisions || []).some(d => /entertainment temporal boost suppressed/.test(d))).toBe(false);
  });
});

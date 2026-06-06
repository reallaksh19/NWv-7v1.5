import { describe, expect, it } from 'vitest';
import { matchesEntertainmentGuard } from './rankingPolicy.js';

describe('entertainmentGuard — word/phrase-boundary (no broad-substring false positives)', () => {
  it('does NOT flag real news that merely contains "season" or "trailer"', () => {
    expect(matchesEntertainmentGuard('Monsoon season floods kill 30 in Assam')).toBe(false);
    expect(matchesEntertainmentGuard('Cyclone season: IMD warns of heavy rain, evacuations begin')).toBe(false);
    expect(matchesEntertainmentGuard('Trailer truck overturns on highway, 3 dead')).toBe(false);
    expect(matchesEntertainmentGuard('Festive season shopping rush in Chennai')).toBe(false);
    expect(matchesEntertainmentGuard('Election season heats up ahead of polls')).toBe(false);
  });

  it('still flags genuine entertainment promos', () => {
    expect(matchesEntertainmentGuard('God of War Laufey gameplay trailer revealed')).toBe(true);
    expect(matchesEntertainmentGuard('Everything announced at State of Play')).toBe(true);
    expect(matchesEntertainmentGuard('New season premiere drops on the streaming service')).toBe(true);
    expect(matchesEntertainmentGuard('Official trailer for the new movie is out')).toBe(true);
  });

  it('does not flag a real conflict headline', () => {
    expect(matchesEntertainmentGuard('West Asia war: Iran missile strike kills dozens in Gulf')).toBe(false);
  });
});

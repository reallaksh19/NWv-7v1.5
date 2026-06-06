import { describe, expect, it } from 'vitest';
import { classifyItemCategory } from './classification.js';

describe('classification F2-7 keyword negatives', () => {
  it('keeps the AUDIT movie and planner category cases classified', () => {
    const cases = [
      ['Leo releasing on Oct 25 in theaters', 'movies'],
      ['Standup Comedy in Chennai this weekend', 'events'],
      ['Heavy rain alert for Tamil Nadu', 'weather_alerts'],
      ['Road blockage at Anna Salai due to protest', 'civic'],
      ['Discount sale at Phoenix Mall', 'shopping'],
    ];

    for (const [title, expectedCategory] of cases) {
      expect(classifyItemCategory({ title }).category).toBe(expectedCategory);
    }
  });

  it('does not let schedule signal words cancel a movie release classification', () => {
    const result = classifyItemCategory({
      title: 'Leo locks release date on Oct 25; trailer launches today',
    });

    expect(result.category).toBe('movies');
    expect(result.classificationBreakdown.matchedGlobalNegative).not.toContain('launches');
  });
});

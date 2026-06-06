import { describe, expect, it } from 'vitest';
import { evaluateNewspaperSlo } from './newspaperSlo.js';

describe('newspaperSlo', () => {
  it('fails when frontPage is empty', () => {
    const result = evaluateNewspaperSlo({
      frontPage: [],
      topStories: [],
    });

    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('newspaper_front_page_empty');
  });

  it('passes usable newspaper and warns source dominance', () => {
    const result = evaluateNewspaperSlo({
      frontPage: Array.from({ length: 10 }, (_, i) => ({ title: `Story ${i}` })),
      topStories: Array.from({ length: 5 }, (_, i) => ({ title: `Top ${i}` })),
      sections: {
        world: [{ title: 'W1' }, { title: 'W2' }],
        india: [{ title: 'I1' }],
        business: [{ title: 'B1' }],
        technology: [{ title: 'T1' }],
      },
      layoutGroups: {
        lead: [{ title: 'L1' }, { title: 'L2' }],
        local: [{ title: 'Loc1' }],
        business: [{ title: 'B1' }],
        technology: [{ title: 'T1' }],
        culture: [{ title: 'C1' }],
      },
      sourceDiversity: {
        topSource: 'SourceA',
        topSourceRatio: 0.5,
      },
    });

    expect(result.passed).toBe(true);
    expect(result.warnings).toContain('newspaper_source_dominance_high');
  });

  it('warns when layout diversity is low', () => {
    const result = evaluateNewspaperSlo({
      frontPage: Array.from({ length: 5 }, (_, i) => ({ title: `Story ${i}` })),
      topStories: [{ title: 'Top 1' }],
      sections: {
        world: [{ title: 'W1' }],
        india: [{ title: 'I1' }],
      },
      layoutGroups: {
        lead: [{ title: 'L1' }],
        local: [{ title: 'Loc1' }],
      },
      sourceDiversity: {
        topSource: 'SourceA',
        topSourceRatio: 0.2,
      },
    });

    expect(result.passed).toBe(true);
    expect(result.warnings).toContain('newspaper_layout_diversity_low');
  });
});

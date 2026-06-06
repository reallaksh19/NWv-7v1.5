import { describe, expect, it } from 'vitest';
import { evaluateSectionsSlo } from './sectionsSlo.js';

describe('sectionsSlo', () => {
  it('fails when sections are empty', () => {
    const result = evaluateSectionsSlo({
      frontPage: [],
      sections: {},
      sectionCounts: {},
    });

    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('sections_empty');
  });

  it('passes usable sections and warns source dominance', () => {
    const result = evaluateSectionsSlo({
      frontPage: [{ title: 'A' }, { title: 'B' }, { title: 'C' }, { title: 'D' }, { title: 'E' }],
      sectionCounts: {
        world: 3,
        india: 2,
      },
      sourceCounts: {
        SourceA: 5,
        SourceB: 1,
      },
    });

    expect(result.passed).toBe(true);
    expect(result.warnings).toContain('sections_source_dominance_high');
    expect(result.warnings).toContain('sections_low_section_diversity');
  });

  it('uses total section items for duplicate-pressure threshold', () => {
    const result = evaluateSectionsSlo({
      frontPage: [{ title: 'A' }],
      sectionCounts: {
        world: 50,
      },
      duplicateHints: Array.from({ length: 6 }, (_, i) => ({ duplicateId: i })),
      sourceCounts: {
        SourceA: 25,
        SourceB: 25,
      },
    });

    expect(result.passed).toBe(true);
    expect(result.warnings).not.toContain('sections_duplicate_pressure_high');
  });
});

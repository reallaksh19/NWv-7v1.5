import { describe, expect, it } from 'vitest';
import { buildStoryInfoText } from './storyMeta.js';

describe('buildStoryInfoText — score breakdown rendering (Phase 0.3)', () => {
  it('renders the score breakdown and decisions', () => {
    const text = buildStoryInfoText(
      {
        title: 'X',
        impactScore: 7.5,
        _scoreBreakdown: {
          freshness: 1.2,
          severity: 1.6,
          decisions: ['war boost suppressed: entertainment guard (god of war)'],
        },
      },
      { includeScoreBreakdown: true },
    );
    expect(text).toContain('Ranking Score: 7.50');
    expect(text).toContain('Severity: 1.60');
    expect(text).toContain('entertainment guard');
  });

  it('shows Formula line in breakdown', () => {
    const text = buildStoryInfoText(
      { title: 'Y', impactScore: 5, _scoreBreakdown: { freshness: 2, severity: 1, decisions: [] } },
      { includeScoreBreakdown: true },
    );
    expect(text).toContain('Formula:');
  });

  it('does not render breakdown when flag is false', () => {
    const text = buildStoryInfoText(
      { title: 'Z', impactScore: 9, _scoreBreakdown: { freshness: 3, severity: 1.6, decisions: [] } },
      { includeScoreBreakdown: false },
    );
    expect(text).not.toContain('Ranking Score');
  });
});

import { describe, expect, it } from 'vitest';
import { evaluateInsightSlo } from './insightSlo.js';

describe('insightSlo', () => {
  it('fails zero insight stories', () => {
    const result = evaluateInsightSlo({
      quality: {
        storyCount: 0,
      },
    });

    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('insight_story_count_zero');
  });

  it('passes usable pre-generated insight without warning solely due to stale label', () => {
    const result = evaluateInsightSlo({
      quality: {
        storyCount: 120,
        sourceGroupCount: 5,
        usableParentCount: 10,
      },
      source: 'snapshot',
      staleLabel: 'Pre-generated · 4h ago',
      repairState: {
        preserved: true,
      },
    });

    expect(result.passed).toBe(true);
    expect(result.metrics.hasStaleLabel).toBe(true);
    expect(result.warnings).not.toContain('insight_stale_or_pregenerated');
    expect(result.warnings).not.toContain('insight_stale_snapshot');
  });

  it('warns target shortfalls without failing nonzero insight', () => {
    const result = evaluateInsightSlo({
      quality: {
        storyCount: 20,
        sourceGroupCount: 2,
        usableParentCount: 1,
      },
      source: 'snapshot',
      staleLabel: 'Pre-generated · 4h ago',
      repairState: {
        preserved: true,
      },
    });

    expect(result.passed).toBe(true);
    expect(result.warnings).toContain('insight_story_count_below_target');
    expect(result.warnings).toContain('insight_source_group_count_below_target');
    expect(result.warnings).toContain('insight_usable_parent_count_below_target');
  });

  it('warns stale snapshot source', () => {
    const result = evaluateInsightSlo({
      quality: {
        storyCount: 120,
        sourceGroupCount: 5,
        usableParentCount: 10,
      },
      source: 'stale-snapshot',
      staleLabel: 'Pre-generated · 24h ago',
      repairState: {
        preserved: true,
      },
    });

    expect(result.passed).toBe(true);
    expect(result.warnings).toContain('insight_stale_snapshot');
  });

  it('warns (not fails) when stories exist but usable parent count is zero', () => {
    const result = evaluateInsightSlo({
      quality: {
        storyCount: 50,
        sourceGroupCount: 3,
        usableParentCount: 0,
      },
      source: 'live',
    });

    // Must not fail the SLO — data arrived, clustering just didn't produce parents
    expect(result.passed).toBe(true);
    expect(result.warnings).toContain('insight_no_usable_parents');
    expect(result.reasons).not.toContain('insight_no_usable_parents');
  });

  it('warns about unavailable source (already failing from zero stories)', () => {
    const result = evaluateInsightSlo({
      quality: {
        storyCount: 0,
        sourceGroupCount: 0,
        usableParentCount: 0,
      },
      source: 'unavailable',
    });

    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('insight_story_count_zero');
    expect(result.warnings).toContain('insight_source_unavailable');
  });

  it('warns about failed source (already failing from zero stories)', () => {
    const result = evaluateInsightSlo({
      quality: {
        storyCount: 0,
        sourceGroupCount: 0,
        usableParentCount: 0,
      },
      source: 'failed',
    });

    expect(result.passed).toBe(false);
    expect(result.warnings).toContain('insight_source_unavailable');
  });
});

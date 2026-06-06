import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');

describe('data-state components', () => {
  it('exports all data-state primitives from barrel file', () => {
    const src = read('src/components/data-state/index.js');

    expect(src).toContain('DataFreshnessBadge');
    expect(src).toContain('DataSourceBadge');
    expect(src).toContain('DataSloBadge');
    expect(src).toContain('DataStateBanner');
    expect(src).toContain('DataRetrySection');
    expect(src).toContain('DataSkeleton');
    expect(src).toContain('DataStateMeta');
  });

  it('freshness badge supports freshness tones', () => {
    const src = read('src/components/data-state/DataFreshnessBadge.internals.js');

    expect(src).toContain('getFreshnessLabel');
    expect(src).toContain('getFreshnessTone');
    expect(src).toContain('fresh');
    expect(src).toContain('stale');
    expect(src).toContain('empty');
  });

  it('source badge supports fallback and failed states', () => {
    const src = read('src/components/data-state/DataSourceBadge.internals.js');

    expect(src).toContain('fallbackUsed');
    expect(src).toContain('failed');
    expect(src).toContain('getSourceTone');
  });

  it('SLO badge normalizes score safely', () => {
    const src = read('src/components/data-state/DataSloBadge.internals.js');

    expect(src).toContain('normalizeScore');
    expect(src).toContain('Math.max(0, Math.min(100');
    expect(src).toContain('SLO unknown');
  });

  it('DataStateMeta guards warning arrays', () => {
    const src = read('src/components/data-state/DataStateMeta.internals.js');

    expect(src).toContain('function asArray');
    expect(src).toContain('asArray(envelope?.validation?.warnings)');
    expect(src).toContain('asArray(envelope?.slo?.warnings)');
    expect(src).toContain('getWarningCount');
  });
});

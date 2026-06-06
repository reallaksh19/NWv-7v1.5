import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('DataHealthPanel', () => {
  const src = fs.readFileSync('src/components/DataHealthPanel.jsx', 'utf8');

  it('uses production dataset cache reader', () => {
    expect(src).toContain('listDatasetCache');
    expect(src).not.toContain('__getDatasetCacheForTest');
  });

  it('subscribes to diagnostics store', () => {
    expect(src).toContain('subscribeDiagnostics');
    expect(src).toContain('listDiagnostics');
    expect(src).toContain('clearDiagnostics');
  });

  it('guards browser globals for export', () => {
    expect(src).toContain("typeof navigator !== 'undefined'");
    expect(src).toContain("typeof document !== 'undefined'");
    expect(src).toContain("typeof Blob !== 'undefined'");
    expect(src).toContain("typeof URL !== 'undefined'");
  });

  it('shows envelope fields and export controls', () => {
    expect(src).toContain('payloadHash');
    expect(src).toContain('freshness');
    expect(src).toContain('fallbackUsed');
    expect(src).toContain('Clear diagnostics');
    expect(src).toContain('Export JSON');
  });
});

import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = fs.readFileSync('src/pages/UpAheadPage.jsx', 'utf8');

describe('UpAheadPage fallback reload wiring', () => {
  it('uses the page ViewModel loadData path for DataStateBoundary retry and force refresh', () => {
    expect(src).not.toContain('useUpAheadTabViewModel');
    expect(src).not.toContain('catch {');
    expect(src).not.toContain('reload: () => {}');
    expect(src).toContain('const handleRefresh = () => loadData({ forceRefresh: false });');
    expect(src).toContain('const handleForceRefresh = () => loadData({ forceRefresh: true, liveOnly: true });');
    expect(src).toContain('onRetry={handleRefresh}');
  });
});

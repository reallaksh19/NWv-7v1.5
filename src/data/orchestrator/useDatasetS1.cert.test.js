import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./useDataset.js', import.meta.url), 'utf8');

describe('useDataset S-1 scheduling', () => {
  it('does not synchronously call reload from the auto-load effect body', () => {
    expect(source).not.toContain('  useEffect(() => {\n    if (!auto) return;\n    reload(false).catch(() => {});');
    expect(source).toContain('queueMicrotask');
  });
});

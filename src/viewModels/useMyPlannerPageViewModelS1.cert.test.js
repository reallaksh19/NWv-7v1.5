import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./useMyPlannerPageViewModel.js', import.meta.url), 'utf8');

describe('useMyPlannerPageViewModel S-1 scheduling', () => {
  it('does not synchronously load planner data from the mount effect body', () => {
    expect(source).not.toContain('  useEffect(() => {\n    loadPlan();');
    expect(source).toContain('queueMicrotask');
  });
});

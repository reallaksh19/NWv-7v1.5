import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  __upAheadPageViewModelInternalsForTest,
} from '../viewModels/useUpAheadPageViewModel.js';

const read = path => fs.readFileSync(path, 'utf8');

function hasHookCall(content, name) {
  return new RegExp(`\\b${name}\\s*\\(`).test(content);
}

describe('Release 6R UpAheadPage ViewModel binding', () => {
  const page = read('src/pages/UpAheadPage.jsx');
  const vm = read('src/viewModels/useUpAheadPageViewModel.js');

  it('UpAheadPage no longer owns settings/runtime/service/planner orchestration', () => {
    expect(page).not.toContain("from '../context/SettingsContext'");
    expect(page).not.toContain("from '../services/upAheadService'");
    expect(page).not.toContain("from '../utils/plannerStorage'");
    expect(page).not.toContain("from '../runtime/runtimeCapabilities'");
    expect(page).not.toContain("from '../services/upAheadEvidence'");
    expect(page).not.toContain("from '../services/upAheadBriefing'");
    expect(hasHookCall(page, 'useSettings')).toBe(false);
    expect(page).toContain('useUpAheadPageViewModel');
  });

  it('ViewModel owns data fetch, cache, runtime and planner logic', () => {
    [
      "from '../context/SettingsContext'",
      "from '../services/upAheadService'",
      "from '../utils/plannerStorage'",
      "from '../runtime/runtimeCapabilities'",
      "from '../services/upAheadEvidence'",
      "from '../services/upAheadBriefing'",
      'fetchStaticUpAheadData',
      'fetchLiveUpAheadData',
      'mergeUpAheadData',
      'loadFromCache',
      'saveToCache',
      'clearUpAheadCache',
      'plannerStorage.addItem',
      'plannerStorage.addToBlacklist',
      'getRuntimeCapabilities',
    ].forEach(token => {
      expect(vm).toContain(token);
    });
  });

  it('UpAheadPage preserves evidence, briefing, data-state and timeline UI', () => {
    expect(page).toContain('<UpAheadEvidencePanel evidence={upAheadEvidence} />');
    expect(page).toContain('<UpAheadBriefingPanel briefing={upAheadBriefing} />');
    expect(page).toContain('<DataStatePill mode={modeStr} label={modeLabel} />');
    expect(page).toContain('TimelineCard');
    expect(page).toContain('EntertainmentStyleGrid');
  });

  it('source mode projection handles static and live runtimes', () => {
    const { getSourceModeState } = __upAheadPageViewModelInternalsForTest;

    expect(getSourceModeState({
      data: { sourceMode: 'snapshot' },
      runtime: { isStaticHost: true },
    })).toEqual({
      modeStr: 'snapshot',
      modeLabel: 'Snapshot',
    });

    expect(getSourceModeState({
      data: { sourceMode: 'cache' },
      runtime: { isStaticHost: false },
    })).toEqual({
      modeStr: 'cached',
      modeLabel: 'Cached',
    });
  });

  it('visible content detector handles timeline, sections and weekly plan', () => {
    const { hasVisibleUpAheadContent } = __upAheadPageViewModelInternalsForTest;

    expect(hasVisibleUpAheadContent({ timeline: [{ items: [{ id: 'x' }] }] })).toBe(true);
    expect(hasVisibleUpAheadContent({ sections: { movies: [{ id: 'x' }] } })).toBe(true);
    expect(hasVisibleUpAheadContent({ weekly_plan: [{ items: [{ id: 'x' }] }] })).toBe(true);
    expect(hasVisibleUpAheadContent({ timeline: [], sections: {}, weekly_plan: [] })).toBe(false);
  });
});

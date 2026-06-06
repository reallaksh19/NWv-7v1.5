import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import {
  buildShellRuntimeProps,
} from '../viewModels/useShellRuntimeProps.js';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function getHeaderBlocks(content) {
  return content.match(/<Header[\s\S]*?\/>/g) || [];
}

function getPageHeaderConsumers() {
  return fs.readdirSync('src/pages')
    .filter(file => file.endsWith('.jsx'))
    .map(file => `src/pages/${file}`)
    .map(path => {
      const content = read(path);
      return {
        path,
        content,
        blocks: getHeaderBlocks(content),
      };
    })
    .filter(entry => entry.blocks.length > 0);
}

describe('Header runtime Release 6I app-wide propagation', () => {
  const header = read('src/components/Header.jsx');
  const hook = read('src/viewModels/useShellRuntimeProps.js');
  const mainVm = read('src/viewModels/useMainTabViewModel.js');

  it('Header remains runtime-prop-driven and does not call runtimeCapabilities', () => {
    expect(header).not.toContain("from '../runtime/runtimeCapabilities'");
    expect(header).not.toContain('getRuntimeCapabilities');
    expect(header).toContain('shellRuntimeProps = null');
    expect(header).toContain('shellRuntimeProps?.showStaticHostBadge');
  });

  it('useShellRuntimeProps owns runtime capability lookup', () => {
    expect(hook).toContain('getRuntimeCapabilities');
    expect(hook).toContain('buildShellRuntimeProps');
    expect(hook).toContain('useShellRuntimeProps');
    expect(hook).toContain('showStaticHostBadge');
    expect(hook).toContain('staticHostBadgeTitle');
    expect(hook).toContain('staticHostBadgeLabel');
    expect(hook).toContain('staticHostBadgeIcon');
  });

  it('buildShellRuntimeProps derives static-host badge state', () => {
    expect(buildShellRuntimeProps({ isStaticHost: true })).toEqual({
      showStaticHostBadge: true,
      staticHostBadgeTitle: 'Static-host mode: snapshot/cache-first behavior is active.',
      staticHostBadgeLabel: 'Static-host mode',
      staticHostBadgeIcon: '📦',
    });

    expect(buildShellRuntimeProps({ isStaticHost: false }).showStaticHostBadge).toBe(false);
    expect(buildShellRuntimeProps(null).showStaticHostBadge).toBe(false);
  });

  it('all page-level Header blocks pass shellRuntimeProps', () => {
    const consumers = getPageHeaderConsumers();

    expect(consumers.length).toBeGreaterThan(0);

    const unbound = [];

    consumers.forEach(entry => {
      entry.blocks.forEach((block, index) => {
        if (!block.includes('shellRuntimeProps={shellRuntimeProps}')) {
          unbound.push(`${entry.path}#${index + 1}`);
        }
      });
    });

    expect(unbound).toEqual([]);
  });

  it('all page-level Header consumers have the correct runtime prop source', () => {
    const consumers = getPageHeaderConsumers();

    const invalid = [];

    consumers.forEach(entry => {
      if (entry.path === 'src/pages/MainPage.jsx') {
        if (
          !entry.content.includes('shellRuntimeProps,') ||
          entry.content.includes('useShellRuntimeProps')
        ) {
          invalid.push(entry.path);
        }
      } else if (!entry.content.includes('useShellRuntimeProps')) {
        invalid.push(entry.path);
      }
    });

    expect(invalid).toEqual([]);
  });

  it('MainPage uses ViewModel-provided shellRuntimeProps, not useShellRuntimeProps directly', () => {
    const mainPage = read('src/pages/MainPage.jsx');

    expect(mainPage).toContain('shellRuntimeProps,');
    expect(mainPage).toContain('shellRuntimeProps={shellRuntimeProps}');
    expect(mainPage).not.toContain('useShellRuntimeProps');
    expect(mainVm).toContain('shellRuntimeProps');
  });

  it('previous Main child bindings remain preserved', () => {
    [
      'quickWeatherProps',
      'newsSectionProps',
      'travelLocalStoriesProps',
      'marketTickerProps',
      'themeToggleProps',
      'ensureMarketBoot',
      'getMarketTickerDataState',
      'shellRuntimeProps',
    ].forEach(token => {
      expect(mainVm).toContain(token);
    });
  });

  it('SettingsPage keeps page-level runtime diagnostics when present', () => {
    const settingsPage = read('src/pages/SettingsPage.jsx');

    expect(settingsPage).toContain('useShellRuntimeProps');

    if (settingsPage.includes('getRuntimeCapabilities')) {
      expect(settingsPage).toContain('getRuntimeCapabilities');
    }
  });
});

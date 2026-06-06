import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('Header runtime Release 6H binding', () => {
  const header = fs.readFileSync('src/components/Header.jsx', 'utf8');
  const mainVm = fs.readFileSync('src/viewModels/useMainTabViewModel.js', 'utf8');
  const mainPage = fs.readFileSync('src/pages/MainPage.jsx', 'utf8');

  it('Header no longer imports or calls runtimeCapabilities directly', () => {
    expect(header).not.toContain("from '../runtime/runtimeCapabilities'");
    expect(header).not.toContain('getRuntimeCapabilities');
  });

  it('Header accepts shellRuntimeProps', () => {
    expect(header).toContain('shellRuntimeProps = null');
  });

  it('Header renders runtime badge from shellRuntimeProps only', () => {
    expect(header).toContain('shellRuntimeProps?.showStaticHostBadge');
    expect(header).toContain('shellRuntimeProps.staticHostBadgeTitle');
    expect(header).toContain('shellRuntimeProps.staticHostBadgeLabel');
    expect(header).toContain('shellRuntimeProps.staticHostBadgeIcon');
    expect(header).toContain('runtime-badge runtime-badge--icon-only');
  });

  it('Header does not own runtime badge text except fallback rendering', () => {
    expect(
      !header.includes('snapshot/cache-first behavior is active') ||
      header.includes('shellRuntimeProps.staticHostBadgeTitle')
    ).toBe(true);

    expect(
      !header.includes('📦') ||
      header.includes("shellRuntimeProps.staticHostBadgeIcon || '📦'")
    ).toBe(true);
  });

  it('Header preserves previous shell bindings', () => {
    expect(header).toContain('themeToggleProps = null');
    expect(header).toContain('<ThemeToggle {...(themeToggleProps || {})} />');

    expect(header).toContain('marketTickerProps = null');
    expect(header).toContain('{...(marketTickerProps || {})}');
    expect(header).toContain('<MarketTicker');

    expect(header).toContain('toggleDevMobileViewOverride');
    expect(header).toContain('DataStatePill');
  });

  it('previous 6G shell bindings remain applied', () => {
    const themeToggle = fs.readFileSync('src/components/ThemeToggle.jsx', 'utf8');
    const timelineHeader = fs.readFileSync('src/components/TimelineHeader.jsx', 'utf8');

    expect(themeToggle).not.toContain('useSettings');
    expect(themeToggle).toContain('onToggleTheme');

    expect(timelineHeader).toContain('marketTickerProps = null');
    expect(timelineHeader).toContain('{...(marketTickerProps || {})}');
    expect(timelineHeader).not.toContain('<MarketTicker loadingPhase={loadingPhase} />');
  });

  it('Main ViewModel exposes shellRuntimeProps', () => {
    expect(mainVm).toContain('shellRuntimeProps');
    expect(mainVm).toContain('showStaticHostBadge');
    expect(mainVm).toContain('staticHostBadgeTitle');
    expect(mainVm).toContain('staticHostBadgeLabel');
    expect(mainVm).toContain('staticHostBadgeIcon');
    expect(mainVm).toContain('runtime?.isStaticHost');
  });

  it('Main ViewModel preserves previous child bindings', () => {
    [
      'quickWeatherProps',
      'newsSectionProps',
      'travelLocalStoriesProps',
      'marketTickerProps',
      'themeToggleProps',
      'ensureMarketBoot',
      'getMarketTickerDataState',
    ].forEach(token => {
      expect(mainVm).toContain(token);
    });
  });

  it('MainPage binds shellRuntimeProps only to Header, not TimelineHeader', () => {
    const headerBlocks = mainPage.match(/<Header[\s\S]*?\/>/g) || [];

    expect(headerBlocks.length).toBeGreaterThan(0);

    expect(
      headerBlocks.every(block => block.includes('shellRuntimeProps={shellRuntimeProps}'))
    ).toBe(true);
  });

  it('MainPage still passes market and theme shell props to Header', () => {
    const headerBlocks = mainPage.match(/<Header[\s\S]*?\/>/g) || [];

    expect(
      headerBlocks.every(block => block.includes('marketTickerProps={marketTickerProps}'))
    ).toBe(true);

    expect(
      headerBlocks.every(block => block.includes('themeToggleProps={themeToggleProps}'))
    ).toBe(true);
  });
});

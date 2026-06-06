import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('Header shell Release 6G binding', () => {
  const themeToggle = fs.readFileSync('src/components/ThemeToggle.jsx', 'utf8');
  const header = fs.readFileSync('src/components/Header.jsx', 'utf8');
  const timelineHeader = fs.readFileSync('src/components/TimelineHeader.jsx', 'utf8');
  const mainVm = fs.readFileSync('src/viewModels/useMainTabViewModel.js', 'utf8');
  const mainPage = fs.readFileSync('src/pages/MainPage.jsx', 'utf8');

  it('ThemeToggle no longer imports or calls SettingsContext directly', () => {
    expect(themeToggle).not.toContain("from '../context/SettingsContext'");
    expect(themeToggle).not.toContain('useSettings');
    expect(themeToggle).toContain("theme = 'dark'");
    expect(themeToggle).toContain('onToggleTheme = null');
    expect(themeToggle).toContain("typeof onToggleTheme !== 'function'");
  });

  it('ThemeToggle guards callback failures', () => {
    expect(themeToggle).toContain('[ThemeToggle] onToggleTheme failed');
  });

  it('Header accepts and forwards themeToggleProps', () => {
    expect(header).toContain('themeToggleProps = null');
    expect(header).toContain('<ThemeToggle {...(themeToggleProps || {})} />');
  });

  it('Header still forwards marketTickerProps', () => {
    expect(header).toContain('marketTickerProps = null');
    expect(header).toContain('{...(marketTickerProps || {})}');
    expect(header).toContain('<MarketTicker');
  });

  it('TimelineHeader accepts icon and marketTickerProps', () => {
    expect(timelineHeader).toContain('icon = null');
    expect(timelineHeader).toContain('marketTickerProps = null');
    expect(timelineHeader).toContain('{icon && <span aria-hidden="true">{icon}</span>}');
  });

  it('TimelineHeader forwards marketTickerProps and has no bare ticker', () => {
    expect(timelineHeader).toContain('{...(marketTickerProps || {})}');
    expect(timelineHeader).toContain('<MarketTicker');
    expect(timelineHeader).not.toContain('<MarketTicker loadingPhase={loadingPhase} />');
  });

  it('Main ViewModel preserves previous child bindings', () => {
    [
      'quickWeatherProps',
      'newsSectionProps',
      'travelLocalStoriesProps',
      'marketTickerProps',
      'ensureMarketBoot',
      'getMarketTickerDataState',
    ].forEach(token => {
      expect(mainVm).toContain(token);
    });
  });

  it('Main ViewModel guards and normalizes theme updates', () => {
    expect(mainVm).toContain('themeToggleProps');
    expect(mainVm).toContain('toggleTheme');
    expect(mainVm).toContain('onToggleTheme: toggleTheme');
    expect(mainVm).toContain('theme: safeSettings.theme ||');
    expect(mainVm).toContain('[useMainTabViewModel] theme toggle failed');
    expect(mainVm).toContain("nextTheme === 'light' ? 'light' : 'dark'");
  });

  it('MainPage passes marketTickerProps to all header modes', () => {
    const timelineHeaderBlocks = mainPage.match(/<TimelineHeader[\s\S]*?\/>/g) || [];
    const headerBlocks = mainPage.match(/<Header[\s\S]*?\/>/g) || [];

    expect(timelineHeaderBlocks.length).toBeGreaterThan(0);
    expect(headerBlocks.length).toBeGreaterThan(0);

    expect(
      timelineHeaderBlocks.every(block => block.includes('marketTickerProps={marketTickerProps}'))
    ).toBe(true);

    expect(
      headerBlocks.every(block => block.includes('marketTickerProps={marketTickerProps}'))
    ).toBe(true);
  });

  it('MainPage passes themeToggleProps to Header', () => {
    const headerBlocks = mainPage.match(/<Header[\s\S]*?\/>/g) || [];

    expect(headerBlocks.length).toBeGreaterThan(0);

    expect(
      headerBlocks.every(block => block.includes('themeToggleProps={themeToggleProps}'))
    ).toBe(true);
  });
});

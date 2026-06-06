import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('TechSocialPage Release 5D migration', () => {
  const src = fs.readFileSync('src/pages/TechSocialPage.jsx', 'utf8');

  it('uses Buzz ViewModel and DataStateBoundary', () => {
    expect(src).toContain('useBuzzTabViewModel');
    expect(src).toContain('DataStateBoundary');
  });

  it('does not use NewsContext or SettingsContext directly', () => {
    expect(src).not.toContain("from '../context/NewsContext'");
    expect(src).not.toContain("from '../context/SettingsContext'");
    expect(src).not.toContain('useNews');
    expect(src).not.toContain('useSettings');
  });

  it('does not perform page-level localStorage cache management', () => {
    expect(src).not.toContain('localStorage');
    expect(src).not.toContain('CACHE_KEY');
    expect(src).not.toContain('buzz_page_cache');
  });

  it('does not lazy-load or refresh sections directly', () => {
    expect(src).not.toContain('loadSection');
    expect(src).not.toContain('refreshNews');
  });

  it('keeps Buzz Hub UI sections', () => {
    expect(src).toContain('id="entertainment"');
    expect(src).toContain('id="social-trends"');
    expect(src).toContain('id="tech-news"');
    expect(src).toContain('id="ai-innovation"');
    expect(src).toContain('SectionNavigator');
  });

  it('keeps refresh routed through ViewModel reload', () => {
    expect(src).toContain('handleRefresh');
    expect(src).toContain('reload(true)');
    expect(src).toContain('onRefresh={handleRefresh}');
  });

  it('passes dataset error into DataStateBoundary', () => {
    expect(src).toContain("errorMessage={error || 'Unable to load Buzz Hub.'}");
  });
});

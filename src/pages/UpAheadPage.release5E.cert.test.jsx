import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('UpAheadPage Release 5E migration', () => {
  const src = fs.readFileSync('src/pages/UpAheadPage.jsx', 'utf8');

  it('uses Up Ahead ViewModel and DataStateBoundary', () => {
    expect(src).toContain('useUpAheadPageViewModel');
    expect(src).toContain('DataStateBoundary');
  });

  it('does not import Up Ahead service functions directly', () => {
    expect(src).not.toContain('fetchStaticUpAheadData');
    expect(src).not.toContain('fetchLiveUpAheadData');
    expect(src).not.toContain('mergeUpAheadData');
    expect(src).not.toContain('loadFromCache');
    expect(src).not.toContain('saveToCache');
    expect(src).not.toContain('clearUpAheadCache');
  });

  it('does not import SettingsContext or runtime capabilities directly', () => {
    expect(src).not.toContain("from '../context/SettingsContext'");
    expect(src).not.toContain('getRuntimeCapabilities');
    expect(src).not.toContain('useSettings');
  });

  it('does not import plannerStorage directly', () => {
    expect(src).not.toContain('plannerStorage');
  });

  it('does not build evidence or briefing directly in the page', () => {
    expect(src).not.toContain('getUpAheadEvidence');
    expect(src).not.toContain('getUpAheadBriefing');
  });

  it('preserves Up Ahead UI sections', () => {
    expect(src).toContain("view === 'plan'");
    expect(src).toContain("view === 'offers'");
    expect(src).toContain("view === 'movies'");
    expect(src).toContain("view === 'events'");
    expect(src).toContain("view === 'alerts'");
    expect(src).toContain("view === 'festivals'");
    expect(src).toContain("view === 'feed'");
  });

  it('routes refresh through ViewModel reload methods', () => {
    expect(src).toContain('handleForceRefresh');
    expect(src).toContain('handleRefresh');
    expect(src).toContain('loadData({ forceRefresh: false })');
    expect(src).toContain('loadData({ forceRefresh: true, liveOnly: true })');
  });

  it('passes dataset error into DataStateBoundary', () => {
    expect(src).toContain("errorMessage={error || 'Unable to load Up Ahead.'}");
  });

  it('does not double-transform prebuilt movie/festival cards', () => {
    expect(src).toContain('article={item}');
    expect(src).not.toContain('article={buildCardArticle(item)}');
  });
});

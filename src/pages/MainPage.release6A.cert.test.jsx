import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('MainPage Release 6A migration', () => {
  const src = fs.readFileSync('src/pages/MainPage.jsx', 'utf8');

  it('uses Main ViewModel and DataStateBoundary', () => {
    expect(src).toContain('useMainTabViewModel');
    expect(src).toContain('DataStateBoundary');
  });

  it('does not import data contexts directly', () => {
    expect(src).not.toContain("from '../context/WeatherContext'");
    expect(src).not.toContain("from '../context/NewsContext'");
    expect(src).not.toContain("from '../context/SettingsContext'");
    expect(src).not.toContain("from '../context/SegmentContext'");
    expect(src).not.toContain('useWeather');
    expect(src).not.toContain('useNews');
    expect(src).not.toContain('useSettings');
    expect(src).not.toContain('useSegment');
  });

  it('does not own travel/topline/storage/audit orchestration directly', () => {
    expect(src).not.toContain('fetchTravelNewsPayload');
    expect(src).not.toContain('mergeTravelNewsIntoNewsData');
    expect(src).not.toContain('applyTravelLocationPriority');
    expect(src).not.toContain('getTravelLocationProfile');
    expect(src).not.toContain('generateTopline');
    expect(src).not.toContain('fetchOnThisDay');
    expect(src).not.toContain('shouldShowOnThisDay');
    expect(src).not.toContain('getViewCount');
    expect(src).not.toContain('isArticleRead');
    expect(src).not.toContain('auditMainTabQuality');
  });

  it('does not contain unsafe refreshNews boolean call', () => {
    expect(src).not.toContain('refreshNews' + '(true)');
  });

  it('does not directly access Notification.permission', () => {
    expect(src).not.toContain('Notification.permission');
  });

  it('preserves current Main UI components', () => {
    expect(src).toContain('GradeBadge');
    expect(src).toContain('TimelineHeader');
    expect(src).toContain('Header');
    expect(src).toContain('QuickWeather');
    expect(src).toContain('BreakingNews');
    expect(src).toContain('NewsSection');
    expect(src).toContain('SectionNavigator');
    expect(src).toContain('TravelLocationBanner');
    expect(src).toContain('TravelLocalStories');
  });

  it('preserves responsive desktop and mobile layouts', () => {
    expect(src).toContain('main-page-grid');
    expect(src).toContain('content-wrapper');
    expect(src).toContain('left-col');
    expect(src).toContain('right-col');
  });

  it('routes pull-to-refresh through ViewModel refreshAll', () => {
    expect(src).toContain('usePullToRefresh(refreshAll)');
  });

  it('uses projected fallback topline instead of direct getTopline call', () => {
    expect(src).toContain('fallbackTopline');
    expect(src).not.toContain('getTopline(');
  });

  it('does not treat empty Main data as ready', () => {
    expect(src).toContain('treatEmptyAsReady={false}');
    expect(src).not.toContain('treatEmptyAsReady={true}');
  });
});

import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = path => fs.readFileSync(path, 'utf8');

function hasImportFrom(content, sourcePath) {
  const escaped = sourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`from\\s+['"]${escaped}['"]`).test(content);
}

function hasBareFetch(content) {
  return /\bfetch\s*\(/.test(content);
}

const activePageFiles = [
  'src/pages/MainPage.jsx',
  'src/pages/InsightPage.jsx',
  'src/pages/WeatherPage.jsx',
  'src/pages/MarketPage.jsx',
  'src/pages/RefreshPage.jsx',
  'src/pages/TechSocialPage.jsx',
  'src/pages/NewspaperPage.jsx',
  'src/pages/UpAheadPage.jsx',
  'src/pages/MyPlannerPage.jsx',
  'src/pages/SettingsPage.jsx',
  'src/pages/FollowingPage.jsx',
  'src/pages/TopicDetail.jsx',
  'src/pages/MorePage.jsx',
];

const forbiddenImports = [
  '../context/WeatherContext',
  '../context/NewsContext',
  '../context/MarketContext',
  '../context/SettingsContext',
  '../services/geminiService',
  '../services/virtualPaperService',
  '../services/upAheadService',
  '../utils/plannerStorage',
  '../runtime/runtimeCapabilities',
];

const expectedViewModelBindings = {
  'src/pages/WeatherPage.jsx': 'useWeatherTabViewModel',
  'src/pages/MarketPage.jsx': 'useMarketPageViewModel',
  'src/pages/RefreshPage.jsx': 'useRefreshPageViewModel',
  'src/pages/TechSocialPage.jsx': 'useTechSocialPageViewModel',
  'src/pages/NewspaperPage.jsx': 'useNewspaperPageViewModel',
  'src/pages/UpAheadPage.jsx': 'useUpAheadPageViewModel',
  'src/pages/MyPlannerPage.jsx': 'useMyPlannerPageViewModel',
};

describe('Release 6T page-orchestration closeout', () => {
  it('active pages avoid direct context/service orchestration imports', () => {
    activePageFiles.forEach(path => {
      const content = read(path);

      forbiddenImports.forEach(source => {
        expect(hasImportFrom(content, source), `${path} must not import ${source}`).toBe(false);
      });
    });
  });

  it('active pages avoid direct browser data fetch and storage ownership', () => {
    activePageFiles.forEach(path => {
      const content = read(path);

      expect(hasBareFetch(content), `${path} must not call fetch() directly`).toBe(false);
      expect(content.includes('localStorage.setItem'), `${path} must not write localStorage`).toBe(false);
      expect(content.includes('localStorage.getItem'), `${path} must not read localStorage`).toBe(false);
      expect(content.includes('sessionStorage.'), `${path} must not own sessionStorage`).toBe(false);
    });
  });

  it('migrated pages are bound through explicit ViewModels', () => {
    Object.entries(expectedViewModelBindings).forEach(([path, token]) => {
      expect(read(path), `${path} must contain ${token}`).toContain(token);
    });
  });

  it('App remains a provider shell and does not own fetch/storage', () => {
    const app = read('src/App.jsx');

    [
      'SettingsProvider',
      'WeatherProvider',
      'NewsProvider',
      'MarketProvider',
      'SegmentProvider',
      'TopicProvider',
    ].forEach(token => {
      expect(app).toContain(token);
    });

    expect(hasBareFetch(app)).toBe(false);
    expect(app).not.toContain('localStorage.setItem');
    expect(app).not.toContain('localStorage.getItem');
  });

  it('closeout documentation exists and records the certification contract', () => {
    const doc = read('docs/RELEASE_6T_PAGE_ORCHESTRATION_CLOSEOUT.md');

    [
      'Release 6T',
      'Page-Orchestration Closeout',
      'Active pages with direct context imports',
      'Active pages with direct data service imports',
      'Vite build',
    ].forEach(token => {
      expect(doc).toContain(token);
    });
  });
});

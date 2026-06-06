import fs from 'node:fs';

const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exit(1);
};

const pass = (condition, message) => {
  if (!condition) fail(message);
};

const read = path => fs.readFileSync(path, 'utf8');

function exists(path) {
  return fs.existsSync(path);
}

function hasImportFrom(content, sourcePath) {
  const escaped = sourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`from\\s+['"]${escaped}['"]`).test(content);
}

function hasAnyImportFrom(content, sourcePaths) {
  return sourcePaths.some(sourcePath => hasImportFrom(content, sourcePath));
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

const expectedViewModelBindings = {
  'src/pages/WeatherPage.jsx': 'useWeatherTabViewModel',
  'src/pages/MarketPage.jsx': 'useMarketPageViewModel',
  'src/pages/RefreshPage.jsx': 'useRefreshPageViewModel',
  'src/pages/TechSocialPage.jsx': 'useTechSocialPageViewModel',
  'src/pages/NewspaperPage.jsx': 'useNewspaperPageViewModel',
  'src/pages/UpAheadPage.jsx': 'useUpAheadPageViewModel',
  'src/pages/MyPlannerPage.jsx': 'useMyPlannerPageViewModel',
};

const forbiddenPageImports = [
  '../context/WeatherContext',
  '../context/NewsContext',
  '../context/MarketContext',
  '../context/SettingsContext',
  '../context/SegmentContext',
  '../context/TopicContext',
  '../services/geminiService',
  '../services/virtualPaperService',
  '../services/upAheadService',
  '../services/upAheadEvidence',
  '../services/upAheadBriefing',
  '../services/plannerEvidence',
  '../services/plannerViewModel',
  '../services/plannerBulkActions',
  '../services/plannerItemInspector',
  '../services/plannerAgendaExport',
  '../services/plannerInteractionQuality',
  '../services/plannerStateHygiene',
  '../services/weatherLocations',
  '../services/weatherDataSource',
  '../runtime/runtimeCapabilities',
  '../utils/plannerStorage',
];

const forbiddenPageTokens = [
  'localStorage.setItem',
  'localStorage.getItem',
  'sessionStorage.setItem',
  'sessionStorage.getItem',
  'plannerStorage.',
  'geminiService.',
  'virtualPaperService.',
  'fetchStaticUpAheadData',
  'fetchLiveUpAheadData',
  'mergeUpAheadData',
  'loadFromCache(',
  'saveToCache(',
  'clearUpAheadCache(',
  'getPlannerEvidence(',
  'getPlannerViewModel(',
  'getPlannerBulkActionSummary(',
  'getPlannerItemInspector(',
  'getPlannerAgendaExport(',
  'reconcilePlannerSelection(',
];

activePageFiles.forEach(path => {
  pass(exists(path), `Active page missing: ${path}`);

  const content = read(path);

  pass(
    !hasAnyImportFrom(content, forbiddenPageImports),
    `${path} imports forbidden orchestration dependency`
  );

  pass(
    !hasBareFetch(content),
    `${path} must not call fetch() directly`
  );

  forbiddenPageTokens.forEach(token => {
    pass(
      !content.includes(token),
      `${path} contains forbidden page orchestration token: ${token}`
    );
  });
});

Object.entries(expectedViewModelBindings).forEach(([path, token]) => {
  const content = read(path);

  pass(
    content.includes(token),
    `${path} must use ${token}`
  );
});

const app = read('src/App.jsx');

[
  'SettingsProvider',
  'WeatherProvider',
  'NewsProvider',
  'MarketProvider',
  'SegmentProvider',
  'TopicProvider',
].forEach(token => {
  pass(app.includes(token), `App.jsx must preserve provider: ${token}`);
});

pass(!hasBareFetch(app), 'App.jsx must not call fetch() directly');
pass(!app.includes('localStorage.setItem'), 'App.jsx must not write localStorage directly');
pass(!app.includes('localStorage.getItem'), 'App.jsx must not read localStorage directly');

const requiredViewModels = [
  'src/viewModels/useShellRuntimeProps.js',
  'src/viewModels/useWeatherTabViewModel.js',
  'src/viewModels/useMarketPageViewModel.js',
  'src/viewModels/useRefreshPageViewModel.js',
  'src/viewModels/useTechSocialPageViewModel.js',
  'src/viewModels/useNewspaperPageViewModel.js',
  'src/viewModels/useUpAheadPageViewModel.js',
  'src/viewModels/useMyPlannerPageViewModel.js',
];

requiredViewModels.forEach(path => {
  pass(exists(path), `Required ViewModel missing: ${path}`);
});

const pkg = JSON.parse(read('package.json'));

[
  'test:hardening:release6T',
  'test:page-orchestration-closeout',
].forEach(scriptName => {
  pass(pkg.scripts?.[scriptName], `package.json missing ${scriptName} script`);
});

['date-fns', 'lodash', 'zod'].forEach(dep => {
  pass(!pkg.dependencies?.[dep], `Release 6T must not add dependency ${dep}`);
  pass(!pkg.devDependencies?.[dep], `Release 6T must not add devDependency ${dep}`);
});

console.log('PASS: Release 6T page-orchestration closeout static gates');

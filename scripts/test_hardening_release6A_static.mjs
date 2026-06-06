import fs from 'node:fs';

const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exit(1);
};

const pass = (condition, message) => {
  if (!condition) fail(message);
};

const exists = path => fs.existsSync(path);
const read = path => fs.readFileSync(path, 'utf8');

[
  'src/components/DataStateBoundary.jsx',
  'src/components/data-state/index.js',
  'src/data/datasets/index.js',
  'src/data/datasets/mainDataset.js',
  'src/viewModels/useInsightTabViewModel.js',
  'src/pages/InsightPage.jsx',
  'scripts/test_hardening_release5G_static.mjs',
].forEach(path => {
  pass(exists(path), `Missing Release 6A prerequisite: ${path}`);
});

[
  'src/viewModels/useMainTabViewModel.js',
  'src/pages/MainPage.jsx',
  'src/viewModels/useMainTabViewModel.cert.test.js',
  'src/pages/MainPage.release6A.cert.test.jsx',
].forEach(path => {
  pass(exists(path), `Missing Release 6A file: ${path}`);
});

const registry = read('src/data/datasets/index.js');
const mainDataset = read('src/data/datasets/mainDataset.js');
const vm = read('src/viewModels/useMainTabViewModel.js');
const page = read('src/pages/MainPage.jsx');
const insightVm = read('src/viewModels/useInsightTabViewModel.js');
const insightPage = read('src/pages/InsightPage.jsx');

pass(insightPage.includes('useInsightTabViewModel'), 'Release 5G prerequisite missing: InsightPage not migrated');
pass(insightPage.includes('DataStateBoundary'), 'Release 5G prerequisite missing: InsightPage missing DataStateBoundary');
pass(insightVm.includes('hasCacheAcceptableInsightResult'), 'Release 5G prerequisite missing: Insight cache quality gate');
pass(insightVm.includes('hasMeaningfulInsightChange'), 'Release 5G prerequisite missing: meaningful Insight change detection');
pass(insightPage.includes('insight-quality-inline'), 'Release 5G prerequisite missing: visible compact Insight quality line');

pass(registry.includes('main'), 'DATASET_LOADERS must register main');
pass(
  mainDataset.includes("datasetId: 'main'") || mainDataset.includes('datasetId: "main"'),
  'mainDataset must emit datasetId main'
);

pass(vm.includes("useDataset('main')"), 'Main ViewModel must use main dataset');
pass(vm.includes('useWeather'), 'Main ViewModel must own WeatherContext access');
pass(vm.includes('useNews'), 'Main ViewModel must own NewsContext access');
pass(vm.includes('useSettings'), 'Main ViewModel must own SettingsContext access');
pass(vm.includes('useSegment'), 'Main ViewModel must own SegmentContext access');

[
  'getTravelLocationProfile',
  'fetchTravelNewsPayload',
  'mergeTravelNewsIntoNewsData',
  'applyTravelLocationPriority',
  'generateTopline',
  'fetchOnThisDay',
  'shouldShowOnThisDay',
  'getViewCount',
  'isArticleRead',
  'auditMainTabQuality',
].forEach(token => {
  pass(vm.includes(token), `Main ViewModel must own ${token}`);
});

pass(vm.includes('data.frontPage'), 'Main ViewModel must support mainDataset frontPage shape');
pass(vm.includes('data.quickWeather'), 'Main ViewModel must support mainDataset quickWeather shape');
pass(vm.includes('data.raw?.newsData'), 'Main ViewModel must support raw newsData fallback');
pass(vm.includes('travelLocationProfile?.prioritizeStories'), 'Top Stories must respect travel priority when enabled');
pass(vm.includes('prioritizedNewsData.frontPage'), 'Top Stories must read prioritized frontPage when travel priority is enabled');
pass(vm.includes("typeof Notification === 'undefined'"), 'Main ViewModel must guard Notification access');

pass(vm.includes('Promise.allSettled'), 'Main ViewModel must use Promise.allSettled for refresh fan-out');
pass(vm.includes('refreshWeather(true)'), 'Main ViewModel must force refresh weather on manual refresh');
pass(vm.includes('refreshNews()'), 'Main ViewModel must call refreshNews() without boolean argument');
pass(!vm.includes('refreshNews(true)'), 'Main ViewModel must not call refreshNews(true)');
pass(vm.includes('getRefreshOutcome'), 'Main ViewModel must own refresh outcome policy');
pass(vm.includes('degraded: true'), 'Main ViewModel must support degraded refresh success');
pass(vm.includes('main_loading_without_renderable_projection'), 'Main ViewModel must not mark loading-only empty data as OK');
pass(vm.includes('makeMainBoundaryEnvelope'), 'Main ViewModel must create boundary envelope');
pass(vm.includes('main.view_model.projected_data'), 'Main ViewModel must add projection diagnostics');

pass(page.includes('useMainTabViewModel'), 'MainPage must use Main ViewModel');
pass(page.includes('DataStateBoundary'), 'MainPage must use DataStateBoundary');
pass(page.includes('usePullToRefresh(refreshAll)'), 'MainPage pull-to-refresh must use ViewModel refreshAll');

[
  "from '../context/WeatherContext'",
  "from '../context/NewsContext'",
  "from '../context/SettingsContext'",
  "from '../context/SegmentContext'",
  'useWeather',
  'useNews',
  'useSettings',
  'useSegment',
  'refreshNews(true)',
  'fetchTravelNewsPayload',
  'mergeTravelNewsIntoNewsData',
  'applyTravelLocationPriority',
  'getTravelLocationProfile',
  'generateTopline',
  'fetchOnThisDay',
  'shouldShowOnThisDay',
  'getViewCount',
  'isArticleRead',
  'auditMainTabQuality',
  'getTopline(',
  'Notification.permission',
].forEach(token => {
  pass(!page.includes(token), `MainPage must not contain ${token}`);
});

[
  'GradeBadge',
  'TimelineHeader',
  'Header',
  'QuickWeather',
  'BreakingNews',
  'NewsSection',
  'SectionNavigator',
  'TravelLocationBanner',
  'TravelLocalStories',
  'main-page-grid',
  'content-wrapper',
  'back-to-top',
].forEach(token => {
  pass(page.includes(token), `MainPage lost UI token: ${token}`);
});

pass(page.includes('treatEmptyAsReady={false}'), 'MainPage must not treat empty Main data as ready');
pass(!page.includes('treatEmptyAsReady={true}'), 'MainPage must not set treatEmptyAsReady true');

const forbiddenPages = [
  'src/pages/InsightPage.jsx',
  'src/pages/FollowingPage.jsx',
  'src/pages/MyPlannerPage.jsx',
  'src/pages/NewspaperPage.jsx',
];

for (const file of forbiddenPages) {
  const content = read(file);
  pass(!content.includes('release6A'), `${file} must not be modified for Release 6A markers`);
}

const pkg = JSON.parse(read('package.json'));

pass(
  pkg.scripts?.['test:hardening:release6A'] === 'node scripts/test_hardening_release6A_static.mjs',
  'package.json missing test:hardening:release6A script'
);

pass(
  typeof pkg.scripts?.['test:main-migration'] === 'string',
  'package.json missing test:main-migration script'
);

[
  'useMainTabViewModel.cert.test.js',
  'MainPage.release6A.cert.test.jsx',
].forEach(testFile => {
  pass(
    pkg.scripts['test:main-migration'].includes(testFile),
    `package.json test:main-migration missing ${testFile}`
  );
});

[
  'date-fns',
  'lodash',
  'zod',
].forEach(dep => {
  pass(!pkg.dependencies?.[dep], `Release 6A must not add dependency ${dep}`);
  pass(!pkg.devDependencies?.[dep], `Release 6A must not add devDependency ${dep}`);
});

const workflowDir = '.github/workflows';

if (exists(workflowDir)) {
  const workflowFiles = fs.readdirSync(workflowDir)
    .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'));

  for (const file of workflowFiles) {
    const content = read(`${workflowDir}/${file}`);
    pass(!content.includes('release6A'), `Release 6A must not modify workflows: ${file}`);
  }
}

console.log('PASS: Release 6A corrected Main migration gates');

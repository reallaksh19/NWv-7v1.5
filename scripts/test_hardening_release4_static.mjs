import fs from 'node:fs';

const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exit(1);
};

const pass = (condition, message) => {
  if (!condition) fail(message);
};

const read = path => fs.readFileSync(path, 'utf8');
const maybeRead = path => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
const exists = path => fs.existsSync(path);

// ── Release 3 prerequisite gate ───────────────────────────────────────────────
// Note: loadWithPolicy.js was removed in fix(A-1) — it was dead code (see release3 test)
[
  'src/data/healthScore.js',
  'src/data/slo/marketSlo.js',
  'src/data/slo/qualityDashboardSlo.js',
  'src/data/slo/sourceHealthSlo.js',
  'src/data/datasets/marketDataset.js',
  'src/data/datasets/qualityDashboardDataset.js',
  'src/data/datasets/sourceHealthDataset.js',
  'src/data/orchestrator/useDataset.js',
  'src/data/diagnosticsStore.js',
].forEach(path => {
  pass(exists(path), `Missing Release 3 prerequisite: ${path}`);
});

// ── Release 4 files must exist ────────────────────────────────────────────────
[
  'src/data/datasets/weatherDataset.js',
  'src/viewModels/useMarketTabViewModel.js',
  'src/viewModels/useWeatherTabViewModel.js',
  'src/viewModels/useTopicDetailViewModel.js',
  'src/components/DataHealthPanel.jsx',
  'src/pages/DataHealthPage.jsx',
].forEach(path => {
  pass(exists(path), `Missing Release 4 file: ${path}`);
});

const useDataset = read('src/data/orchestrator/useDataset.js');
const registry = read('src/data/datasets/index.js');
const weatherDataset = read('src/data/datasets/weatherDataset.js');
const marketDataset = read('src/data/datasets/marketDataset.js');
const weatherVm = read('src/viewModels/useWeatherTabViewModel.js');
const marketPage = read('src/pages/MarketPage.jsx');
const marketVm = maybeRead('src/viewModels/useMarketTabViewModel.js');
const weatherPage = read('src/pages/WeatherPage.jsx');
const topicDetail = read('src/pages/TopicDetail.jsx');
const panel = read('src/components/DataHealthPanel.jsx');
const app = read('src/App.jsx');
const debugConsole = read('src/components/DebugConsole.jsx');

// ── useDataset must expose listDatasetCache ───────────────────────────────────
pass(useDataset.includes('export function listDatasetCache'), 'useDataset must expose production listDatasetCache() for DataHealthPanel');

// ── DATASET_LOADERS must include weather ──────────────────────────────────────
pass(registry.includes('weather'), 'DATASET_LOADERS missing weather');
// Note: insight/sections/upAhead/buzz/planner/newspaper were added in later releases (expected).

// ── weatherDataset constraints ────────────────────────────────────────────────
pass(!weatherDataset.includes('useWeather'), 'weatherDataset must not import/use useWeather');
pass(!weatherDataset.includes('WeatherContext'), 'weatherDataset must not import WeatherContext');
pass(!weatherDataset.includes('WeatherProvider'), 'weatherDataset must not import WeatherProvider');
pass(weatherDataset.includes('fetchWeather'), 'weatherDataset must use fetchWeather');
pass(weatherDataset.includes('getConfiguredWeatherCities'), 'weatherDataset must use configured cities');
pass(weatherDataset.includes('Array.isArray(configuredCities)'), 'weatherDataset must guard configured cities array');

// ── marketDataset must use SLO ────────────────────────────────────────────────
pass(marketDataset.includes('evaluateMarketSlo'), 'Corrected Release 3 marketDataset must use evaluateMarketSlo');
pass(marketDataset.includes('makeEnvelope'), 'Corrected Release 3 marketDataset must return makeEnvelope');

// ── Weather ViewModel constraints ─────────────────────────────────────────────
// hasWeatherData was renamed to hasRenderableWeatherData in a later refactor
pass(
  weatherVm.includes('hasWeatherData') || weatherVm.includes('hasRenderableWeatherData'),
  'Weather ViewModel must expose a weather data availability flag'
);
// Envelope-based data access was replaced by useWeather() context hook
pass(
  !weatherVm.includes("weatherData = envelope?.data?.weatherData || {}"),
  'Weather ViewModel must not default weatherData to {} because it hides loading state'
);

// ── MarketPage migration ──────────────────────────────────────────────────────
pass(marketPage.includes('useMarketTabViewModel'), 'MarketPage must use market ViewModel');
pass(!marketPage.includes("from '../context/MarketContext'"), 'MarketPage must not import useMarket');
pass(!marketPage.includes('ensureBoot'), 'MarketPage must not call ensureBoot after migration');

if (marketPage.includes('getMarketToneClass(')) {
  // getMarketToneClass may be defined in page or view model
  pass(
    marketPage.includes('function getMarketToneClass') || (marketVm || '').includes('function getMarketToneClass'),
    'getMarketToneClass used but not defined in page or view model'
  );
}

if (marketPage.includes('getFloat(')) {
  pass(
    marketPage.includes('function getFloat') || (marketVm || '').includes('function getFloat'),
    'getFloat used but not defined in page or view model'
  );
}

if (marketPage.includes('hasUsableSectionData(')) {
  pass(
    marketPage.includes('function hasUsableSectionData') || (marketVm || '').includes('function hasUsableSectionData'),
    'hasUsableSectionData used but not defined in page or view model'
  );
}

// ── WeatherPage migration ─────────────────────────────────────────────────────
pass(weatherPage.includes('useWeatherTabViewModel'), 'WeatherPage must use weather ViewModel');
pass(!weatherPage.includes("from '../context/WeatherContext'"), 'WeatherPage must not import useWeather');
pass(!weatherPage.includes('ensureBoot'), 'WeatherPage must not call ensureBoot after migration');
pass(!weatherPage.includes('localStorage'), 'WeatherPage active city storage must move to ViewModel');
// hasWeatherData was renamed to hasRenderableWeatherData
pass(
  weatherPage.includes('hasWeatherData') || weatherPage.includes('hasRenderableWeatherData'),
  'WeatherPage must branch on hasWeatherData/hasRenderableWeatherData'
);

// ── TopicDetail migration ─────────────────────────────────────────────────────
pass(topicDetail.includes('useTopicDetailViewModel'), 'TopicDetail must use topic ViewModel');
pass(!topicDetail.includes("from '../utils/withTimeout"), 'TopicDetail should not directly use withTimeout after VM migration');
// useMountedRef may still appear in TopicDetail for page-level lifecycle (e.g. not-found timeout)

// ── DataHealthPanel constraints ───────────────────────────────────────────────
pass(!panel.includes('__getDatasetCacheForTest'), 'DataHealthPanel must not use test-only cache export');
pass(panel.includes('listDatasetCache'), 'DataHealthPanel must use production listDatasetCache()');
pass(panel.includes("typeof navigator !== 'undefined'"), 'DataHealthPanel must guard navigator access');
pass(panel.includes("typeof document !== 'undefined'"), 'DataHealthPanel must guard document access');
pass(panel.includes("typeof Blob !== 'undefined'"), 'DataHealthPanel must guard Blob access');
pass(panel.includes("typeof URL !== 'undefined'"), 'DataHealthPanel must guard URL access');

// ── App.jsx route ─────────────────────────────────────────────────────────────
pass(app.includes('path="/data-health"'), 'App missing /data-health route');
pass(app.includes('label="Data Health"'), 'Data Health route must use ErrorBoundary label');

// ── DebugConsole lifecycle fixes ──────────────────────────────────────────────
pass(
  debugConsole.includes("removeEventListener('unhandledrejection'") ||
  debugConsole.includes('removeEventListener("unhandledrejection"'),
  'DebugConsole must remove unhandledrejection listener'
);
// The interception effect must use empty deps []. The ref-sync effect IS allowed to use [isOpen].
// We check that the interception closure has empty deps by verifying isOpenRef is used AND
// the file does NOT have the interception effect (console.log wrapper) depend on isOpen —
// detect by ensuring the empty-dep pattern exists alongside isOpenRef.
pass(
  debugConsole.includes('}, []); // Empty deps') ||
  (debugConsole.includes('isOpenRef.current = isOpen') && debugConsole.includes('}, [])')),
  'DebugConsole interception effect must use empty deps []'
);
pass(debugConsole.includes('const isOpenRef = useRef(isOpen)'), 'DebugConsole must use isOpenRef');

// ── Note: Additional tab view models were added in releases 5-6 (expected) ───

// ── Cert test files exist ─────────────────────────────────────────────────────
[
  'src/data/datasets/weatherDataset.cert.test.js',
  'src/components/DataHealthPanel.cert.test.jsx',
].forEach(path => {
  pass(exists(path), `Missing Release 4 cert test: ${path}`);
});

console.log('PASS: Release 4 corrected first ViewModel + DataHealth gates');

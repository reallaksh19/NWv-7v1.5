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

const release4Prerequisites = [
  'src/data/datasets/weatherDataset.js',
  'src/viewModels/useMarketTabViewModel.js',
  'src/viewModels/useWeatherTabViewModel.js',
  'src/viewModels/useTopicDetailViewModel.js',
  'src/components/DataHealthPanel.jsx',
  'src/pages/DataHealthPage.jsx',
];

release4Prerequisites.forEach(path => {
  pass(exists(path), `Missing Release 4 prerequisite: ${path}`);
});

const datasetFiles = [
  'src/data/datasets/sectionsDataset.js',
  'src/data/datasets/buzzDataset.js',
  'src/data/datasets/upAheadDataset.js',
  'src/data/datasets/newspaperDataset.js',
  'src/data/datasets/plannerDataset.js',
  'src/data/datasets/followingDataset.js',
  'src/data/datasets/insightDataset.js',
  'src/data/datasets/mainDataset.js',
];

datasetFiles.forEach(path => {
  pass(exists(path), `Missing Release 5A dataset file: ${path}`);

  const src = read(path);
  pass(src.includes('makeEnvelope'), `${path} must import/use makeEnvelope`);
  pass(!src.includes('useNews('), `${path} must not use NewsContext`);
  pass(!src.includes('useWeather('), `${path} must not use WeatherContext`);
  pass(!src.includes('useMarket('), `${path} must not use MarketContext`);
  pass(!src.includes('useTopics('), `${path} must not use TopicContext`);
});

const registry = read('src/data/datasets/index.js');

[
  'market',
  'weather',
  'qualityDashboard',
  'sourceHealth',
  'sections',
  'buzz',
  'upAhead',
  'newspaper',
  'planner',
  'following',
  'insight',
  'main',
].forEach(name => {
  pass(registry.includes(`${name}:`), `DATASET_LOADERS missing ${name}`);
});

const loaderEntries = (registry.match(/^\s+[a-zA-Z0-9]+:\s+[a-zA-Z0-9]+Dataset,/gm) || []).length;
pass(loaderEntries === 12, `DATASET_LOADERS should have exactly 12 entries, found ${loaderEntries}`);

const sections = read('src/data/datasets/sectionsDataset.js');
pass(sections.includes('DEFAULT_MAX_SECTIONS = 6'), 'sectionsDataset must define DEFAULT_MAX_SECTIONS = 6');
pass(sections.includes('maxSections'), 'sectionsDataset must support maxSections');
pass(sections.includes('section_limit_applied'), 'sectionsDataset must diagnose section limit truncation');

const buzz = read('src/data/datasets/buzzDataset.js');
pass(buzz.includes('function hasAiSignal'), 'buzzDataset must use hasAiSignal helper');
pass(buzz.includes('/\\bai\\b/'), 'buzzDataset must use word-boundary AI regex');

const upAhead = read('src/data/datasets/upAheadDataset.js');
pass(upAhead.includes('loadFromCache()'), 'upAheadDataset must call loadFromCache() with actual signature');
pass(!upAhead.includes('loadFromCache(upAheadSettings)'), 'upAheadDataset must not pass fake args to loadFromCache');
// fetchStaticUpAheadData may be called with or without settings (signature evolved)
pass(upAhead.includes('fetchStaticUpAheadData'), 'upAheadDataset must call fetchStaticUpAheadData');
pass(upAhead.includes('mergeUpAheadData(data, staticData)'), 'upAheadDataset must call mergeUpAheadData(baseData, newData)');
pass(!upAhead.includes('mergeUpAheadData(data, staticData, upAheadSettings)'), 'upAheadDataset must not pass fake third arg to mergeUpAheadData');
pass(upAhead.includes('saveToCache(data)'), 'upAheadDataset must call saveToCache(data)');
pass(!upAhead.includes('saveToCache(data, upAheadSettings)'), 'upAheadDataset must not pass fake args to saveToCache');
pass(upAhead.includes('weatherAlerts'), 'upAheadDataset must expose weatherAlerts');
pass(upAhead.includes('combinedAlerts'), 'upAheadDataset must expose combinedAlerts');
pass(upAhead.includes('civics'), 'upAheadDataset must expose civics');
pass(upAhead.includes('live_empty'), 'upAheadDataset must detect empty live fallback');

const planner = read('src/data/datasets/plannerDataset.js');
pass(planner.includes('Planner storage is stateful by design'), 'plannerDataset must document stateful storage behavior');
pass(planner.includes('plannerDataset.sync_attempted'), 'plannerDataset must diagnose sync side effect');

const following = read('src/data/datasets/followingDataset.js');
pass(following.includes('followingDataset.empty'), 'followingDataset must handle empty following list explicitly');
pass(following.includes('freshness: ENVELOPE_FRESHNESS.EMPTY'), 'following empty state must be freshness empty');

const insight = read('src/data/datasets/insightDataset.js');
pass(insight.includes('Expensive dataset'), 'insightDataset must document expensive load behavior');
pass(insight.includes('runInsightPipeline'), 'insightDataset must wrap existing insight pipeline');

const main = read('src/data/datasets/mainDataset.js');
pass(main.includes('Release 5A adapter-only dataset'), 'mainDataset must be marked adapter-only');
pass(main.includes('Do not consume from MainPage until Release 5H'), 'mainDataset must warn against early MainPage consumption');
pass(main.includes('const includeInsight = options.includeInsight === true'), 'mainDataset must default includeInsight to false');
pass(main.includes('includeInsight ? loadInsight() : Promise.resolve(null)'), 'mainDataset must not call loadInsight by default');
pass(main.includes('maxSections: 6'), 'mainDataset must bound sections load');
pass(main.includes('main_insight_skipped_adapter_only'), 'mainDataset must diagnose skipped insight');

// Note: useMainTabViewModel and other tab view models were added in later releases (5B-5G, expected)
// Note: Release 5 SLO files were added in later releases (5B+, expected)

const workflowDir = '.github/workflows';
if (exists(workflowDir)) {
  const workflowFiles = fs.readdirSync(workflowDir).filter(file => file.endsWith('.yml') || file.endsWith('.yaml'));
  for (const file of workflowFiles) {
    const content = read(`${workflowDir}/${file}`);
    pass(!content.includes('release5A'), `Release 5A must not modify workflows: ${file}`);
  }
}

console.log('PASS: Release 5A corrected dataset-loader gates');

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
  'src/data/slo/applyDatasetSlo.js',
  'src/components/DataStateBoundary.jsx',
  'src/components/data-state/index.js',
  'src/data/datasets/index.js',
  'src/data/datasets/followingDataset.js',
  'scripts/test_hardening_release5FB_static.mjs',
].forEach(path => {
  pass(exists(path), `Missing Release 5F-B/5C prerequisite: ${path}`);
});

[
  'src/viewModels/useFollowingTabViewModel.js',
  'src/pages/FollowingPage.jsx',
  'src/viewModels/useFollowingTabViewModel.cert.test.js',
  'src/pages/FollowingPage.release5FC.cert.test.jsx',
].forEach(path => {
  pass(exists(path), `Missing Release 5F-C file: ${path}`);
});

const registry = read('src/data/datasets/index.js');
const followingDataset = read('src/data/datasets/followingDataset.js');
const vm = read('src/viewModels/useFollowingTabViewModel.js');
const page = read('src/pages/FollowingPage.jsx');
const plannerPage = read('src/pages/MyPlannerPage.jsx');

pass(plannerPage.includes('usePlannerTabViewModel'), 'Release 5F-B prerequisite missing: MyPlannerPage not migrated');
pass(plannerPage.includes('DataStateBoundary'), 'Release 5F-B prerequisite missing: MyPlannerPage missing DataStateBoundary');

pass(registry.includes('following'), 'DATASET_LOADERS must register following');
pass(followingDataset.includes('applyDatasetSlo'), 'followingDataset must be SLO-wrapped from Release 5C');
pass(
  followingDataset.includes("datasetId: 'following'") || followingDataset.includes('datasetId: "following"'),
  'followingDataset must emit datasetId following'
);

pass(vm.includes("useDataset('following')"), 'Following ViewModel must use following dataset');
pass(vm.includes('useTopics'), 'Following ViewModel must own TopicContext access for actions/messages/fallback');
pass(vm.includes('getTopicStats'), 'Following ViewModel must own topic stats');
pass(vm.includes('sortFollowedTopics'), 'Following ViewModel must own topic sorting');
pass(vm.includes('makeSuggestionTopic'), 'Following ViewModel must own suggestion payload creation');
pass(vm.includes('handleSuggestionClick'), 'Following ViewModel must expose suggestion handler');

pass(vm.includes('getProjectedFollowingData'), 'Following ViewModel must project dataset data first');
pass(vm.includes('datasetFollowedTopics.length > 0'), 'Following ViewModel must prefer dataset followed topics');
pass(vm.includes('Object.keys(datasetTopicNews).length > 0'), 'Following ViewModel must prefer dataset topic news');
pass(vm.includes('normalizeSuggestions'), 'Following ViewModel must normalize suggestions');
pass(vm.includes('getRefreshFailure'), 'Following ViewModel must detect fulfilled failed refresh envelopes');
pass(vm.includes('result.value.ok === false'), 'Following ViewModel must inspect fulfilled failed envelope ok flag');
pass(vm.includes('following.view_model.projected_data'), 'Following boundary envelope must report projected data diagnostics');

pass(vm.includes('Promise.allSettled'), 'Following ViewModel refresh must isolate dataset/context failures');
pass(vm.includes('refreshTopics(shouldNotify)'), 'Following ViewModel must call TopicContext refresh');
pass(vm.includes('reloadDataset(true)'), 'Following ViewModel must call dataset reload');

pass(page.includes('useFollowingTabViewModel'), 'FollowingPage must use Following ViewModel');
pass(page.includes('DataStateBoundary'), 'FollowingPage must use DataStateBoundary');
pass(page.includes('treatEmptyAsReady={true}'), 'FollowingPage must treat empty following state as valid ready UI');
pass(
  page.includes('key={`${suggestion.query || suggestion.word}-${index}`}'),
  'FollowingPage must use robust suggestion key'
);

[
  "from '../context/TopicContext",
  'useTopics',
  'function getTopicStats',
  'refreshTopics(false)',
  'refreshTopics(true)',
  'sortedTopics = useMemo',
].forEach(token => {
  pass(!page.includes(token), `FollowingPage must not contain ${token}`);
});

[
  'TopicSearch',
  'TopicCard',
  'Personal topic desk',
  'Suggested for you',
  'Your Topics',
  'No topics followed yet',
].forEach(token => {
  pass(page.includes(token), `FollowingPage lost UI token: ${token}`);
});

// Note: Insight and Main tab view models were added in later releases (5G, expected)

const pkg = JSON.parse(read('package.json'));

pass(
  pkg.scripts?.['test:hardening:release5FC'] === 'node scripts/test_hardening_release5FC_static.mjs',
  'package.json missing test:hardening:release5FC script'
);

pass(
  typeof pkg.scripts?.['test:following-migration'] === 'string',
  'package.json missing test:following-migration script'
);

[
  'useFollowingTabViewModel.cert.test.js',
  'FollowingPage.release5FC.cert.test.jsx',
].forEach(testFile => {
  pass(
    pkg.scripts['test:following-migration'].includes(testFile),
    `package.json test:following-migration missing ${testFile}`
  );
});

[
  'date-fns',
  'lodash',
  'zod',
].forEach(dep => {
  pass(!pkg.dependencies?.[dep], `Release 5F-C must not add dependency ${dep}`);
  pass(!pkg.devDependencies?.[dep], `Release 5F-C must not add devDependency ${dep}`);
});

const workflowDir = '.github/workflows';

if (exists(workflowDir)) {
  const workflowFiles = fs.readdirSync(workflowDir)
    .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'));

  for (const file of workflowFiles) {
    const content = read(`${workflowDir}/${file}`);
    pass(!content.includes('release5FC'), `Release 5F-C must not modify workflows: ${file}`);
  }
}

console.log('PASS: Release 5F-C corrected Following migration gates');

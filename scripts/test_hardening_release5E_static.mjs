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
  'src/data/datasets/upAheadDataset.js',
  'scripts/test_hardening_release5D_static.mjs',
].forEach(path => {
  pass(exists(path), `Missing Release 5D/5C prerequisite: ${path}`);
});

[
  'src/viewModels/useBuzzTabViewModel.js',
  'src/viewModels/useUpAheadTabViewModel.js',
  'src/pages/UpAheadPage.jsx',
  'src/viewModels/useUpAheadTabViewModel.cert.test.js',
  'src/pages/UpAheadPage.release5E.cert.test.jsx',
].forEach(path => {
  pass(exists(path), `Missing Release 5E file or prerequisite: ${path}`);
});

const registry = read('src/data/datasets/index.js');
const upAheadDataset = read('src/data/datasets/upAheadDataset.js');
const techSocialPage = read('src/pages/TechSocialPage.jsx');
const vm = read('src/viewModels/useUpAheadTabViewModel.js');
const page = read('src/pages/UpAheadPage.jsx');

pass(techSocialPage.includes('useBuzzTabViewModel'), 'Release 5D prerequisite missing: TechSocialPage not migrated');
pass(techSocialPage.includes('DataStateBoundary'), 'Release 5D prerequisite missing: TechSocialPage missing DataStateBoundary');

pass(registry.includes('upAhead'), 'DATASET_LOADERS must register upAhead');
pass(upAheadDataset.includes('applyDatasetSlo'), 'upAheadDataset must be SLO-wrapped from Release 5C');
pass(
  upAheadDataset.includes("datasetId: 'upAhead'") || upAheadDataset.includes('datasetId: "upAhead"'),
  'upAheadDataset must emit datasetId upAhead'
);

pass(vm.includes("useDataset('upAhead')"), 'Up Ahead ViewModel must use upAhead dataset');
pass(vm.includes('deriveVisibleState'), 'Up Ahead ViewModel must project visible state');
pass(vm.includes('addToPlan'), 'Up Ahead ViewModel must own addToPlan');
pass(vm.includes('removeFromPlan'), 'Up Ahead ViewModel must own removeFromPlan');
pass(vm.includes('addLocation'), 'Up Ahead ViewModel must own addLocation');
pass(vm.includes('removeLocation'), 'Up Ahead ViewModel must own removeLocation');
pass(vm.includes('toLocalDateKey'), 'Up Ahead ViewModel must normalize plan dates using local date key');
pass(vm.includes('return { ok: true }'), 'Up Ahead planner actions must return success object');
pass(vm.includes('ok: false'), 'Up Ahead planner actions must return failure object');
pass(vm.includes('try') && vm.includes('catch'), 'Up Ahead planner actions must guard storage errors');
pass(vm.includes("sourceMode === 'cache'"), 'Up Ahead mode mapping must handle cache');
pass(vm.includes('data?.sections || rawData?.sections'), 'Up Ahead projection must support top-level sections');
pass(vm.includes('Array.isArray(data.timeline)'), 'Up Ahead projection must support top-level timeline');

[
  'fetchStaticUpAheadData',
  'fetchLiveUpAheadData',
  'mergeUpAheadData',
  'loadFromCache',
  'saveToCache',
  'clearUpAheadCache',
  'getUpAheadEvidence',
  'getUpAheadBriefing',
].forEach(token => {
  pass(!page.includes(token), `UpAheadPage must not contain service/data token ${token}`);
});

[
  "from '../context/SettingsContext'",
  'useSettings',
  'getRuntimeCapabilities',
  'plannerStorage',
].forEach(token => {
  pass(!page.includes(token), `UpAheadPage must not contain ${token}`);
});

pass(page.includes('useUpAheadPageViewModel'), 'UpAheadPage must use Up Ahead ViewModel');
pass(page.includes('DataStateBoundary'), 'UpAheadPage must use DataStateBoundary');
pass(page.includes("errorMessage={error || 'Unable to load Up Ahead.'}"), 'UpAheadPage must pass dataset error into boundary');
pass(page.includes('article={item}'), 'UpAheadPage must not double-transform prebuilt movie/festival cards');
pass(!page.includes('article={buildCardArticle(item)}'), 'UpAheadPage still double-transforms card articles');

[
  "view === 'plan'",
  "view === 'offers'",
  "view === 'movies'",
  "view === 'events'",
  "view === 'alerts'",
  "view === 'festivals'",
  "view === 'feed'",
  'UpAheadEvidencePanel',
  'UpAheadBriefingPanel',
].forEach(token => {
  pass(page.includes(token), `UpAheadPage lost UI token: ${token}`);
});

const pkg = JSON.parse(read('package.json'));

pass(
  pkg.scripts?.['test:hardening:release5E'] === 'node scripts/test_hardening_release5E_static.mjs',
  'package.json missing test:hardening:release5E script'
);

pass(
  typeof pkg.scripts?.['test:up-ahead-migration'] === 'string',
  'package.json missing test:up-ahead-migration script'
);

[
  'useUpAheadTabViewModel.cert.test.js',
  'UpAheadPage.release5E.cert.test.jsx',
].forEach(testFile => {
  pass(
    pkg.scripts['test:up-ahead-migration'].includes(testFile),
    `package.json test:up-ahead-migration missing ${testFile}`
  );
});

[
  'date-fns',
  'lodash',
  'zod',
].forEach(dep => {
  pass(!pkg.dependencies?.[dep], `Release 5E must not add dependency ${dep}`);
  pass(!pkg.devDependencies?.[dep], `Release 5E must not add devDependency ${dep}`);
});

const workflowDir = '.github/workflows';

if (exists(workflowDir)) {
  const workflowFiles = fs.readdirSync(workflowDir)
    .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'));

  for (const file of workflowFiles) {
    const content = read(`${workflowDir}/${file}`);
    pass(!content.includes('release5E'), `Release 5E must not modify workflows: ${file}`);
  }
}

console.log('PASS: Release 5E corrected Up Ahead migration gates');

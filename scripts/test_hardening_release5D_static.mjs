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
  'src/data/datasets/buzzDataset.js',
  'scripts/test_hardening_release5C_static.mjs',
].forEach(path => {
  pass(exists(path), `Missing Release 5C prerequisite: ${path}`);
});

[
  'src/viewModels/useBuzzTabViewModel.js',
  'src/pages/TechSocialPage.jsx',
  'src/viewModels/useBuzzTabViewModel.cert.test.js',
  'src/pages/TechSocialPage.release5D.cert.test.jsx',
].forEach(path => {
  pass(exists(path), `Missing Release 5D file: ${path}`);
});

const registry = read('src/data/datasets/index.js');
const buzzDataset = read('src/data/datasets/buzzDataset.js');
const buzzVm = read('src/viewModels/useBuzzTabViewModel.js');
const techPage = read('src/pages/TechSocialPage.jsx');

pass(registry.includes('buzz'), 'DATASET_LOADERS must register buzz');
pass(buzzDataset.includes('applyDatasetSlo'), 'buzzDataset must be SLO-wrapped from Release 5C');
pass(
  buzzDataset.includes("datasetId: 'buzz'") || buzzDataset.includes('datasetId: "buzz"'),
  'buzzDataset must emit datasetId buzz'
);

pass(buzzVm.includes("useDataset('buzz')"), 'Buzz ViewModel must use buzz dataset');
pass(buzzVm.includes('useSettings'), 'Buzz ViewModel may use SettingsContext for display preferences');
pass(buzzVm.includes('filterOldNews'), 'Buzz ViewModel must own freshness filtering');
pass(buzzVm.includes('entertainmentByRegion'), 'Buzz ViewModel must expose entertainmentByRegion');
pass(buzzVm.includes('socialTrends'), 'Buzz ViewModel must expose socialTrends');
pass(buzzVm.includes('techCards'), 'Buzz ViewModel must expose techCards');
pass(buzzVm.includes('aiCards'), 'Buzz ViewModel must expose aiCards');
pass(buzzVm.includes('reloadDataset(force)'), 'Buzz ViewModel must expose dataset reload');
pass(buzzVm.includes('Date.parse'), 'Buzz ViewModel getTimestamp must parse ISO dates');
pass(buzzVm.includes('10_000_000_000'), 'Buzz ViewModel getTimestamp must normalize seconds timestamps');

[
  'useNews',
  'NewsContext',
  'refreshNews',
  'loadSection',
  'localStorage',
  'CACHE_KEY',
].forEach(token => {
  pass(!buzzVm.includes(token), `Buzz ViewModel must not contain ${token}`);
});

pass(techPage.includes('useBuzzTabViewModel'), 'TechSocialPage must use Buzz ViewModel');
pass(techPage.includes('DataStateBoundary'), 'TechSocialPage must use DataStateBoundary');
pass(techPage.includes('onRefresh={handleRefresh}'), 'TechSocialPage Header refresh must use ViewModel refresh');
pass(techPage.includes('reload(true)'), 'TechSocialPage refresh must call reload(true)');
pass(
  techPage.includes("errorMessage={error || 'Unable to load Buzz Hub.'}"),
  'TechSocialPage must pass dataset error into DataStateBoundary'
);

[
  "from '../context/NewsContext'",
  "from '../context/SettingsContext'",
  'useNews',
  'useSettings',
  'refreshNews',
  'loadSection',
  'localStorage',
  'CACHE_KEY',
  'buzz_page_cache',
].forEach(token => {
  pass(!techPage.includes(token), `TechSocialPage must not contain ${token}`);
});

[
  'id="entertainment"',
  'id="social-trends"',
  'id="tech-news"',
  'id="ai-innovation"',
  'SectionNavigator',
  'ImageCard',
  'NewsSection',
].forEach(token => {
  pass(techPage.includes(token), `TechSocialPage lost UI token: ${token}`);
});

// Note: Other tab view models and page migrations were added in later releases (5E-5G, expected)

const servicesDir = 'src/services';
if (exists(servicesDir)) {
  const serviceFiles = fs.readdirSync(servicesDir)
    .filter(file => /\.(js|jsx|ts|tsx)$/.test(file));

  for (const file of serviceFiles) {
    const content = read(`${servicesDir}/${file}`);
    pass(!content.includes('release5D'), `Release 5D must not modify service file marker: ${file}`);
  }
}

const pkg = JSON.parse(read('package.json'));

pass(
  pkg.scripts?.['test:hardening:release5D'] === 'node scripts/test_hardening_release5D_static.mjs',
  'package.json missing test:hardening:release5D script'
);

pass(
  typeof pkg.scripts?.['test:buzz-migration'] === 'string',
  'package.json missing test:buzz-migration script'
);

[
  'useBuzzTabViewModel.cert.test.js',
  'TechSocialPage.release5D.cert.test.jsx',
].forEach(testFile => {
  pass(
    pkg.scripts['test:buzz-migration'].includes(testFile),
    `package.json test:buzz-migration missing ${testFile}`
  );
});

[
  'date-fns',
  'lodash',
  'zod',
].forEach(dep => {
  pass(!pkg.dependencies?.[dep], `Release 5D must not add dependency ${dep}`);
  pass(!pkg.devDependencies?.[dep], `Release 5D must not add devDependency ${dep}`);
});

const workflowDir = '.github/workflows';

if (exists(workflowDir)) {
  const workflowFiles = fs.readdirSync(workflowDir)
    .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'));

  for (const file of workflowFiles) {
    const content = read(`${workflowDir}/${file}`);
    pass(!content.includes('release5D'), `Release 5D must not modify workflows: ${file}`);
  }
}

console.log('PASS: Release 5D corrected Buzz / TechSocial migration gates');

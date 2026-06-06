import fs from 'node:fs';
import { execSync } from 'node:child_process';

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

function hasHookCall(content, name) {
  return new RegExp(`\\b${name}\\s*\\(`).test(content);
}

function getChangedFiles() {
  try {
    return execSync('git diff --name-only', { encoding: 'utf8' })
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

const requiredFiles = [
  'src/viewModels/useTechSocialPageViewModel.js',
  'src/pages/TechSocialPage.jsx',
  'src/pages/TechSocialPage.release6P.cert.test.jsx',
  'scripts/test_hardening_release6P_static.mjs',
];

requiredFiles.forEach(path => {
  pass(exists(path), `Required Release 6P file missing: ${path}`);
});

const page = read('src/pages/TechSocialPage.jsx');
const vm = read('src/viewModels/useTechSocialPageViewModel.js');
const pkg = JSON.parse(read('package.json'));

pass(!hasImportFrom(page, '../context/NewsContext'), 'TechSocialPage must not import NewsContext');
pass(!hasImportFrom(page, '../context/SettingsContext'), 'TechSocialPage must not import SettingsContext');
pass(!hasHookCall(page, 'useNews'), 'TechSocialPage must not call useNews()');
pass(!hasHookCall(page, 'useSettings'), 'TechSocialPage must not call useSettings()');
pass(page.includes('useTechSocialPageViewModel'), 'TechSocialPage must use TechSocial ViewModel');
pass(page.includes('shellRuntimeProps={shellRuntimeProps}'), 'TechSocialPage Header must receive shellRuntimeProps');

pass(!page.includes('localStorage.setItem'), 'TechSocialPage must not write Buzz cache directly');
pass(!page.includes('localStorage.getItem'), 'TechSocialPage must not read Buzz cache directly');
pass(!page.includes('refreshNews(['), 'TechSocialPage must not call refreshNews directly');
pass(!page.includes('filterOldNews('), 'TechSocialPage must not own freshness filtering');
pass(!page.includes('processedEntertainment'), 'TechSocialPage must not own entertainment projection');

pass(page.includes('entertainment-tabs'), 'TechSocialPage must preserve entertainment tabs');
pass(page.includes('activeEntTab') && page.includes('setActiveEntTab'), 'TechSocialPage must preserve entertainment tab state from ViewModel');
pass(page.includes('masonry-grid'), 'TechSocialPage must preserve masonry-grid layout');
pass(page.includes('article={{') && page.includes('href={item.link || item.url}'), 'TechSocialPage must pass article/href props to ImageCard');
pass(!page.includes('story={'), 'TechSocialPage must not pass unsupported story prop to ImageCard');

[
  "from '../context/NewsContext'",
  "from '../context/SettingsContext'",
  'useNews',
  'useSettings',
  'BUZZ_REQUIRED_SECTIONS',
  'getPublishedAtMs',
  'hasBuzzLiveData',
  'filterOldNews',
  'projectEntertainmentStories',
  'distributeSocialTrends',
  'projectTechnologyStories',
  'projectAiInnovationStories',
  'safeReadBuzzCache',
  'safeWriteBuzzCache',
  'refreshNews(BUZZ_REQUIRED_SECTIONS)',
  '[useTechSocialPageViewModel] loadSection failed',
  "typeof window === 'undefined'",
  "BUZZ_PAGE_CACHE_KEY = 'buzz_page_cache'",
  'timestamp',
  'data',
  'socialTrends',
].forEach(token => {
  pass(vm.includes(token), `TechSocial ViewModel missing token: ${token}`);
});

pass(
  !vm.includes('setTimeout(() => {\n        setCachedData(cached);'),
  'TechSocial ViewModel must not delay cache hydration via setTimeout'
);

pass(
  !page.includes('socialTrendBuckets'),
  '6P must preserve regional socialTrends contract, not replace with unrelated buckets'
);

const allowedChangedFiles = new Set([
  'src/viewModels/useTechSocialPageViewModel.js',
  'src/pages/TechSocialPage.jsx',
  'src/pages/TechSocialPage.release6P.cert.test.jsx',
  'scripts/test_hardening_release6P_static.mjs',
  'package.json',
]);

for (const file of getChangedFiles()) {
  pass(
    allowedChangedFiles.has(file),
    `Release 6P unexpected changed file: ${file}`
  );
}

['date-fns', 'lodash', 'zod'].forEach(dep => {
  pass(!pkg.dependencies?.[dep], `Release 6P must not add dependency ${dep}`);
  pass(!pkg.devDependencies?.[dep], `Release 6P must not add devDependency ${dep}`);
});

pass(
  pkg.scripts?.['test:hardening:release6P'],
  'package.json missing test:hardening:release6P script'
);

pass(
  pkg.scripts?.['test:techsocial-binding'],
  'package.json missing test:techsocial-binding script'
);

console.log('PASS: Release 6P TechSocial/Buzz Hub static gates');

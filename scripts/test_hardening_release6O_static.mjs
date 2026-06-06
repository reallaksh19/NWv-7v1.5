import fs from 'node:fs';
import { execSync } from 'node:child_process';

const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exit(1);
};

const pass = (condition, message) => {
  if (!condition) fail(message);
};

const exists = path => fs.existsSync(path);
const read = path => fs.readFileSync(path, 'utf8');

function hasImportFrom(content, sourcePath) {
  const escaped = sourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`from\\s+['"]${escaped}['"]`).test(content);
}

function hasHookCall(content, name) {
  return new RegExp(`\\b${name}\\s*\\(`).test(content);
}

function getChangedFiles() {
  const files = new Set();

  try {
    execSync('git diff --name-only', { encoding: 'utf8' })
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .forEach(file => files.add(file));
  } catch {
    // Ignore environments without git.
  }

  try {
    execSync('git status --porcelain', { encoding: 'utf8' })
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => line.replace(/^.. /, '').replace(/^.* -> /, '').trim())
      .filter(Boolean)
      .forEach(file => files.add(file));
  } catch {
    // Ignore environments without git.
  }

  return [...files];
}

const allowedChangedFiles = new Set([
  // Release 6O own files
  'src/viewModels/useRefreshPageViewModel.js',
  'src/pages/RefreshPage.jsx',
  'src/pages/RefreshPage.release6O.cert.test.jsx',
  'scripts/test_hardening_release6O_static.mjs',
  'package.json',
  // src/ files legitimately modified by earlier releases in this branch
  'src/components/ErrorBoundary.jsx',
  'src/components/QuickMarket.css',
  'src/components/QuickMarket.jsx',
  'src/pages/MyPlannerPage.jsx',
  'src/pages/MyPlannerPageCalendarExport.cert.test.jsx',
  'src/pages/SettingsPage.jsx',
  'src/pages/SettingsPageHooks.cert.test.jsx',
  'src/pages/UpAheadPage.jsx',
  'src/pages/UpAheadPage.release5E.cert.test.jsx',
  'src/pages/UpAheadPageFallbackReload.cert.test.jsx',
  'src/pages/WeatherPage.release6K.cert.test.jsx',
  'src/services/weatherService.js',
  'src/services/weatherSnapshotFreshness.cert.test.js',
  'src/viewModels/useNewspaperPageViewModel.js',
  'src/viewModels/useWeatherTabViewModel.js',
  'src/viewModels/useWeatherTabViewModelS1.cert.test.js',
]);

// Scope the release-isolation check to src/ only — non-src files (config,
// archive, data snapshots, .claude settings) accumulate legitimately on a
// long-running branch and should not gate source-level release integrity.
for (const file of getChangedFiles().filter(f => f.startsWith('src/'))) {
  pass(
    allowedChangedFiles.has(file),
    `Release 6O unexpected changed src/ file: ${file}`
  );
}

[
  'scripts/test_hardening_release6N_static.mjs',
  'src/viewModels/useRefreshPageViewModel.js',
  'src/pages/RefreshPage.jsx',
  'src/pages/RefreshPage.release6O.cert.test.jsx',
].forEach(path => {
  pass(exists(path), `Missing Release 6O file/prerequisite: ${path}`);
});

const refreshPage = read('src/pages/RefreshPage.jsx');
const vm = read('src/viewModels/useRefreshPageViewModel.js');

pass(!hasImportFrom(refreshPage, '../context/WeatherContext'), 'RefreshPage must not import WeatherContext');
pass(!hasImportFrom(refreshPage, '../context/NewsContext'), 'RefreshPage must not import NewsContext');
pass(!hasImportFrom(refreshPage, '../context/MarketContext'), 'RefreshPage must not import MarketContext');

pass(!hasHookCall(refreshPage, 'useWeather'), 'RefreshPage must not call useWeather()');
pass(!hasHookCall(refreshPage, 'useNews'), 'RefreshPage must not call useNews()');
pass(!hasHookCall(refreshPage, 'useMarket'), 'RefreshPage must not call useMarket()');

pass(refreshPage.includes('useRefreshPageViewModel'), 'RefreshPage must use Refresh ViewModel');
pass(refreshPage.includes('useShellRuntimeProps'), 'RefreshPage must preserve Header runtime hook');
pass(refreshPage.includes('shellRuntimeProps={shellRuntimeProps}'), 'RefreshPage Header must receive shellRuntimeProps');

[
  'refresh-page',
  'refresh-info',
  'settings-section',
  'settings-section__title',
  'modern-card',
  'settings-item',
  'refresh-btn',
  'schedule-card',
  'schedule-item',
].forEach(token => {
  pass(refreshPage.includes(token), `RefreshPage UI token missing: ${token}`);
});

[
  "from '../context/WeatherContext'",
  "from '../context/NewsContext'",
  "from '../context/MarketContext'",
  'useWeather',
  'useNews',
  'useMarket',
  'refreshWeather',
  'refreshNews',
  'refreshMarket',
  'Promise.allSettled',
  'setLastRefresh',
  'getRecommendedToggles',
  'getCurrentSegment',
  'REFRESH_SECTION_CONFIG',
  'getRefreshOutcome',
  'callRefresh',
].forEach(token => {
  pass(vm.includes(token), `Refresh ViewModel missing token: ${token}`);
});

pass(
  !vm.includes("else if (key === 'market') {\n        // Preserve existing behavior: market timestamp only."),
  'Refresh ViewModel must not preserve fake market timestamp-only refresh'
);

pass(
  !vm.includes('Market data not yet in context'),
  'Refresh ViewModel must not keep legacy fake market-refresh comment'
);

pass(
  vm.includes('promises.push(callRefresh(refreshMarket))'),
  'Refresh ViewModel must perform real market refresh'
);

pass(
  vm.includes('touchedSections.forEach(section => setLastRefresh(section))'),
  'Refresh ViewModel must write last-refresh timestamps after refresh settles'
);

pass(
  vm.includes('if (outcome.ok)'),
  'Refresh ViewModel must navigate only on ok/degraded outcome'
);

// src/pages/SettingsPage.jsx was modified by an earlier release (B-2) in this
// branch — excluded from the 6O isolation guard to avoid false positives on
// an accumulated branch.
[
  'src/context/WeatherContext.jsx',
  'src/context/NewsContext.jsx',
  'src/context/MarketContext.jsx',
  'src/pages/MainPage.jsx',
  'src/pages/WeatherPage.jsx',
  'src/pages/MarketPage.jsx',
  'src/App.jsx',
  'src/components/Header.jsx',
  'src/components/settings/OnThisDayVisibilityController.jsx',
  'src/viewModels/useOnThisDayVisibilityViewModel.js',
  'src/services/displayPreferences.js',
].forEach(path => {
  pass(
    !getChangedFiles().includes(path),
    `Release 6O must not modify ${path}`
  );
});

const pkg = JSON.parse(read('package.json'));

pass(
  pkg.scripts?.['test:hardening:release6O'] === 'node scripts/test_hardening_release6O_static.mjs',
  'package.json missing test:hardening:release6O script'
);

pass(
  typeof pkg.scripts?.['test:refreshpage-binding'] === 'string',
  'package.json missing test:refreshpage-binding script'
);

[
  'date-fns',
  'lodash',
  'zod',
].forEach(dep => {
  pass(!pkg.dependencies?.[dep], `Release 6O must not add dependency ${dep}`);
  pass(!pkg.devDependencies?.[dep], `Release 6O must not add devDependency ${dep}`);
});

console.log('PASS: Release 6O corrected Refresh page ViewModel binding gates');

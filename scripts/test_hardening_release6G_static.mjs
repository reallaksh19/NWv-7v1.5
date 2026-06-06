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
  'src/components/ThemeToggle.jsx',
  'src/components/Header.jsx',
  'src/components/TimelineHeader.jsx',
  'src/viewModels/useMainTabViewModel.js',
  'src/pages/MainPage.jsx',
  'src/components/HeaderShell.release6G.cert.test.jsx',
  'scripts/test_hardening_release6G_static.mjs',
  'scripts/test_hardening_release6F_static.mjs',
  'package.json',
  // 6H and 6I files (pre-committed together in this session)
  'src/components/HeaderRuntime.release6H.cert.test.jsx',
  'scripts/test_hardening_release6H_static.mjs',
  'src/viewModels/useShellRuntimeProps.js',
  'src/components/HeaderRuntime.release6I.cert.test.jsx',
  'scripts/test_hardening_release6I_static.mjs',
  'src/pages/MorePage.jsx',
  'src/pages/FollowingPage.jsx',
  'src/pages/RefreshPage.jsx',
  'src/pages/UpAheadPage.jsx',
  'src/pages/InsightPage.jsx',
  'src/pages/SettingsPage.jsx',
  'src/pages/TopicDetail.jsx',
  'src/pages/MyPlannerPage.jsx',
  'src/pages/TechSocialPage.jsx',
  // 6J files
  'src/viewModels/useMarketTabViewModel.js',
  'src/pages/MarketPage.jsx',
  'src/components/QuickMarket.jsx',
  'src/pages/MarketPage.release6J.cert.test.jsx',
  'scripts/test_hardening_release6J_static.mjs',
  // 6A (already done in prior session)
  'src/intelligence/sourceDominancePolicy.js',
  'src/intelligence/staleStoryPolicy.js',
  'src/intelligence/sourceDominancePolicy.cert.test.js',
  'src/intelligence/staleStoryPolicy.cert.test.js',
  'src/pages/MainPage.release6A.cert.test.jsx',
  'scripts/test_hardening_release6A_static.mjs',
  'scripts/benchmark_editorial_policies.mjs',
  'scripts/certification_manifest.json',
  'scripts/run_certification_gate.mjs',
  'docs/HARDENING_CHANGELOG.md',
  'src/services/rssAggregator.js',
  'src/pages/SettingsPage.jsx',
]);

for (const file of getChangedFiles()) {
  pass(
    allowedChangedFiles.has(file),
    `Release 6G unexpected changed file: ${file}`
  );
}

[
  'scripts/test_hardening_release6F_static.mjs',
  'src/components/ThemeToggle.jsx',
  'src/components/Header.jsx',
  'src/components/TimelineHeader.jsx',
  'src/viewModels/useMainTabViewModel.js',
  'src/pages/MainPage.jsx',
  'src/components/HeaderShell.release6G.cert.test.jsx',
].forEach(path => {
  pass(exists(path), `Missing Release 6G file/prerequisite: ${path}`);
});

const themeToggle = read('src/components/ThemeToggle.jsx');
const header = read('src/components/Header.jsx');
const timelineHeader = read('src/components/TimelineHeader.jsx');
const mainVm = read('src/viewModels/useMainTabViewModel.js');
const mainPage = read('src/pages/MainPage.jsx');

pass(!themeToggle.includes("from '../context/SettingsContext'"), 'ThemeToggle must not import SettingsContext');
pass(!themeToggle.includes('useSettings'), 'ThemeToggle must not call useSettings');
pass(themeToggle.includes("theme = 'dark'"), 'ThemeToggle must accept theme prop');
pass(themeToggle.includes('onToggleTheme = null'), 'ThemeToggle must accept onToggleTheme prop');
pass(themeToggle.includes("typeof onToggleTheme !== 'function'"), 'ThemeToggle must guard missing callback');
pass(themeToggle.includes('[ThemeToggle] onToggleTheme failed'), 'ThemeToggle must guard callback failure');

pass(header.includes('themeToggleProps = null'), 'Header must accept themeToggleProps');
pass(
  header.includes('<ThemeToggle {...(themeToggleProps || {})} />'),
  'Header must forward themeToggleProps'
);

pass(header.includes('marketTickerProps = null'), 'Header must still accept marketTickerProps');
pass(header.includes('{...(marketTickerProps || {})}'), 'Header must still forward marketTickerProps');

pass(timelineHeader.includes('icon = null'), 'TimelineHeader must preserve icon compatibility');
pass(timelineHeader.includes('marketTickerProps = null'), 'TimelineHeader must accept marketTickerProps');
pass(timelineHeader.includes('{...(marketTickerProps || {})}'), 'TimelineHeader must forward marketTickerProps');
pass(timelineHeader.includes('<MarketTicker'), 'TimelineHeader must render MarketTicker');
pass(
  !timelineHeader.includes('<MarketTicker loadingPhase={loadingPhase} />'),
  'TimelineHeader must not contain bare ticker binding'
);

[
  'quickWeatherProps',
  'newsSectionProps',
  'travelLocalStoriesProps',
  'marketTickerProps',
  'ensureMarketBoot',
  'getMarketTickerDataState',
].forEach(token => {
  pass(mainVm.includes(token), `Previous Main binding marker missing after 6G: ${token}`);
});

pass(mainVm.includes('themeToggleProps'), 'Main ViewModel must expose themeToggleProps');
pass(mainVm.includes('[useMainTabViewModel] theme toggle failed'), 'Main ViewModel must guard theme update failures');
pass(mainVm.includes("nextTheme === 'light' ? 'light' : 'dark'"), 'Main ViewModel must normalize theme value');
pass(mainVm.includes('onToggleTheme: toggleTheme'), 'Main ViewModel must pass onToggleTheme');
pass(mainVm.includes('theme: safeSettings.theme ||'), 'Main ViewModel must pass theme value');

const timelineHeaderBlocks = mainPage.match(/<TimelineHeader[\s\S]*?\/>/g) || [];
const headerBlocks = mainPage.match(/<Header[\s\S]*?\/>/g) || [];

pass(timelineHeaderBlocks.length > 0, 'MainPage must render TimelineHeader');
pass(headerBlocks.length > 0, 'MainPage must render Header');

pass(
  timelineHeaderBlocks.every(block => block.includes('marketTickerProps={marketTickerProps}')),
  'Every TimelineHeader instance must receive marketTickerProps'
);

pass(
  headerBlocks.every(block => block.includes('marketTickerProps={marketTickerProps}')),
  'Every Header instance must receive marketTickerProps'
);

pass(
  headerBlocks.every(block => block.includes('themeToggleProps={themeToggleProps}')),
  'Every Header instance must receive themeToggleProps'
);

const pkg = JSON.parse(read('package.json'));

pass(
  pkg.scripts?.['test:hardening:release6G'] === 'node scripts/test_hardening_release6G_static.mjs',
  'package.json missing test:hardening:release6G script'
);

pass(
  typeof pkg.scripts?.['test:headershell-binding'] === 'string',
  'package.json missing test:headershell-binding script'
);

[
  'date-fns',
  'lodash',
  'zod',
].forEach(dep => {
  pass(!pkg.dependencies?.[dep], `Release 6G must not add dependency ${dep}`);
  pass(!pkg.devDependencies?.[dep], `Release 6G must not add devDependency ${dep}`);
});

console.log('PASS: Release 6G corrected Header shell prop binding gates');

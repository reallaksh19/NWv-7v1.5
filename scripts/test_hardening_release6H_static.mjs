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
  'src/components/Header.jsx',
  'src/viewModels/useMainTabViewModel.js',
  'src/pages/MainPage.jsx',
  'src/components/HeaderRuntime.release6H.cert.test.jsx',
  'scripts/test_hardening_release6H_static.mjs',
  'package.json',
  // Files from 6G/6I included since all changes are in the same uncommitted session
  'src/components/ThemeToggle.jsx',
  'src/components/TimelineHeader.jsx',
  'src/components/HeaderShell.release6G.cert.test.jsx',
  'scripts/test_hardening_release6G_static.mjs',
  'scripts/test_hardening_release6F_static.mjs',
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
  // 6J
  'src/viewModels/useMarketTabViewModel.js',
  'src/pages/MarketPage.jsx',
  'src/components/QuickMarket.jsx',
  'src/pages/MarketPage.release6J.cert.test.jsx',
  'scripts/test_hardening_release6J_static.mjs',
  // prior session files
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
    `Release 6H unexpected changed file: ${file}`
  );
}

[
  'scripts/test_hardening_release6G_static.mjs',
  'src/components/Header.jsx',
  'src/viewModels/useMainTabViewModel.js',
  'src/pages/MainPage.jsx',
  'src/components/HeaderRuntime.release6H.cert.test.jsx',
].forEach(path => {
  pass(exists(path), `Missing Release 6H file/prerequisite: ${path}`);
});

const header = read('src/components/Header.jsx');
const mainVm = read('src/viewModels/useMainTabViewModel.js');
const mainPage = read('src/pages/MainPage.jsx');
const themeToggle = read('src/components/ThemeToggle.jsx');
const timelineHeader = read('src/components/TimelineHeader.jsx');

pass(!themeToggle.includes('useSettings'), 'Release 6G prerequisite missing: ThemeToggle still uses SettingsContext');
pass(themeToggle.includes('onToggleTheme'), 'Release 6G prerequisite missing: ThemeToggle is not prop-driven');

pass(timelineHeader.includes('marketTickerProps = null'), 'Release 6G prerequisite missing: TimelineHeader lacks marketTickerProps');
pass(timelineHeader.includes('{...(marketTickerProps || {})}'), 'Release 6G prerequisite missing: TimelineHeader does not forward marketTickerProps');
pass(!timelineHeader.includes('<MarketTicker loadingPhase={loadingPhase} />'), 'Release 6G prerequisite missing: TimelineHeader still has bare ticker binding');

pass(!header.includes("from '../runtime/runtimeCapabilities'"), 'Header must not import runtimeCapabilities');
pass(!header.includes('getRuntimeCapabilities'), 'Header must not call getRuntimeCapabilities');
pass(header.includes('shellRuntimeProps = null'), 'Header must accept shellRuntimeProps');
pass(header.includes('shellRuntimeProps?.showStaticHostBadge'), 'Header must render runtime badge from shellRuntimeProps');

pass(
  !header.includes('snapshot/cache-first behavior is active') ||
  header.includes('shellRuntimeProps.staticHostBadgeTitle'),
  'Header must not hardcode runtime badge title outside shellRuntimeProps'
);

pass(
  !header.includes('📦') ||
  header.includes("shellRuntimeProps.staticHostBadgeIcon || '📦'"),
  'Header must not own static-host badge icon except fallback rendering'
);

[
  'themeToggleProps = null',
  '<ThemeToggle {...(themeToggleProps || {})} />',
  'marketTickerProps = null',
  '{...(marketTickerProps || {})}',
  '<MarketTicker',
  'toggleDevMobileViewOverride',
  'DataStatePill',
].forEach(token => {
  pass(header.includes(token), `Header previous shell marker missing after 6H: ${token}`);
});

[
  'quickWeatherProps',
  'newsSectionProps',
  'travelLocalStoriesProps',
  'marketTickerProps',
  'themeToggleProps',
  'ensureMarketBoot',
  'getMarketTickerDataState',
].forEach(token => {
  pass(mainVm.includes(token), `Previous Main binding marker missing after 6H: ${token}`);
});

pass(mainVm.includes('shellRuntimeProps'), 'Main ViewModel must expose shellRuntimeProps');
pass(mainVm.includes('showStaticHostBadge'), 'Main ViewModel shellRuntimeProps must include showStaticHostBadge');
pass(mainVm.includes('staticHostBadgeTitle'), 'Main ViewModel shellRuntimeProps must include staticHostBadgeTitle');
pass(mainVm.includes('staticHostBadgeLabel'), 'Main ViewModel shellRuntimeProps must include staticHostBadgeLabel');
pass(mainVm.includes('staticHostBadgeIcon'), 'Main ViewModel shellRuntimeProps must include staticHostBadgeIcon');
pass(mainVm.includes('runtime?.isStaticHost'), 'Main ViewModel shellRuntimeProps must derive static-host state from runtime');

const headerBlocks = mainPage.match(/<Header[\s\S]*?\/>/g) || [];

pass(headerBlocks.length > 0, 'MainPage must render Header');

pass(
  headerBlocks.every(block => block.includes('shellRuntimeProps={shellRuntimeProps}')),
  'Every MainPage Header instance must receive shellRuntimeProps'
);

pass(
  headerBlocks.every(block => block.includes('marketTickerProps={marketTickerProps}')),
  'Every MainPage Header instance must preserve marketTickerProps'
);

pass(
  headerBlocks.every(block => block.includes('themeToggleProps={themeToggleProps}')),
  'Every MainPage Header instance must preserve themeToggleProps'
);

const pageFiles = fs.readdirSync('src/pages')
  .filter(file => file.endsWith('.jsx'))
  .map(file => `src/pages/${file}`);

const headerConsumers = pageFiles
  .map(path => ({ path, content: read(path) }))
  .filter(entry => entry.content.includes('<Header'));

const unboundHeaderConsumers = headerConsumers.filter(entry => (
  !entry.content.includes('shellRuntimeProps={shellRuntimeProps}')
));

console.log('[Release 6H] Header consumers:', headerConsumers.map(entry => entry.path));
console.log('[Release 6H] Header consumers without shellRuntimeProps:', unboundHeaderConsumers.map(entry => entry.path));

const pkg = JSON.parse(read('package.json'));

pass(
  pkg.scripts?.['test:hardening:release6H'] === 'node scripts/test_hardening_release6H_static.mjs',
  'package.json missing test:hardening:release6H script'
);

pass(
  typeof pkg.scripts?.['test:headerruntime-binding'] === 'string',
  'package.json missing test:headerruntime-binding script'
);

[
  'date-fns',
  'lodash',
  'zod',
].forEach(dep => {
  pass(!pkg.dependencies?.[dep], `Release 6H must not add dependency ${dep}`);
  pass(!pkg.devDependencies?.[dep], `Release 6H must not add devDependency ${dep}`);
});

console.log('PASS: Release 6H corrected Header runtime prop binding gates');

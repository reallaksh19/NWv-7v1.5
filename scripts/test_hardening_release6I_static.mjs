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

function getHeaderBlocks(content) {
  return content.match(/<Header[\s\S]*?\/>/g) || [];
}

const allowedChangedFiles = new Set([
  'src/viewModels/useShellRuntimeProps.js',
  'src/components/HeaderRuntime.release6I.cert.test.jsx',
  'scripts/test_hardening_release6I_static.mjs',

  'src/pages/MorePage.jsx',
  'src/pages/FollowingPage.jsx',
  'src/pages/RefreshPage.jsx',
  'src/pages/MainPage.jsx',
  'src/pages/UpAheadPage.jsx',
  'src/pages/InsightPage.jsx',
  'src/pages/SettingsPage.jsx',
  'src/pages/TopicDetail.jsx',
  'src/pages/MyPlannerPage.jsx',
  'src/pages/TechSocialPage.jsx',

  'package.json',

  // 6G/6H and other files modified in the same session
  'src/components/ThemeToggle.jsx',
  'src/components/Header.jsx',
  'src/components/TimelineHeader.jsx',
  'src/viewModels/useMainTabViewModel.js',
  'src/components/HeaderShell.release6G.cert.test.jsx',
  'scripts/test_hardening_release6G_static.mjs',
  'scripts/test_hardening_release6F_static.mjs',
  'src/components/HeaderRuntime.release6H.cert.test.jsx',
  'scripts/test_hardening_release6H_static.mjs',
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
]);

for (const file of getChangedFiles()) {
  pass(
    allowedChangedFiles.has(file),
    `Release 6I unexpected changed file: ${file}`
  );
}

[
  'scripts/test_hardening_release6H_static.mjs',
  'src/components/Header.jsx',
  'src/viewModels/useShellRuntimeProps.js',
  'src/viewModels/useMainTabViewModel.js',
  'src/components/HeaderRuntime.release6I.cert.test.jsx',
].forEach(path => {
  pass(exists(path), `Missing Release 6I file/prerequisite: ${path}`);
});

const header = read('src/components/Header.jsx');
const shellHook = read('src/viewModels/useShellRuntimeProps.js');
const mainVm = read('src/viewModels/useMainTabViewModel.js');

pass(
  !header.includes("from '../runtime/runtimeCapabilities'"),
  'Header must not import runtimeCapabilities'
);

pass(
  !header.includes('getRuntimeCapabilities'),
  'Header must not call getRuntimeCapabilities'
);

pass(
  header.includes('shellRuntimeProps = null'),
  'Header must accept shellRuntimeProps'
);

pass(
  header.includes('shellRuntimeProps?.showStaticHostBadge'),
  'Header must render runtime badge from shellRuntimeProps'
);

pass(
  shellHook.includes('getRuntimeCapabilities'),
  'useShellRuntimeProps must own runtime lookup'
);

pass(
  shellHook.includes('export function buildShellRuntimeProps'),
  'useShellRuntimeProps must export buildShellRuntimeProps'
);

pass(
  shellHook.includes('export function useShellRuntimeProps'),
  'useShellRuntimeProps must export useShellRuntimeProps'
);

[
  'showStaticHostBadge',
  'staticHostBadgeTitle',
  'staticHostBadgeLabel',
  'staticHostBadgeIcon',
  'runtime?.isStaticHost',
].forEach(token => {
  pass(shellHook.includes(token), `useShellRuntimeProps missing token: ${token}`);
});

const pageFiles = fs.readdirSync('src/pages')
  .filter(file => file.endsWith('.jsx'))
  .map(file => `src/pages/${file}`);

const headerConsumers = pageFiles
  .map(path => {
    const content = read(path);
    return {
      path,
      content,
      blocks: getHeaderBlocks(content),
    };
  })
  .filter(entry => entry.blocks.length > 0);

pass(
  headerConsumers.length > 0,
  'No Header consumers found in src/pages'
);

const unboundHeaderBlocks = [];

for (const entry of headerConsumers) {
  entry.blocks.forEach((block, index) => {
    if (!block.includes('shellRuntimeProps={shellRuntimeProps}')) {
      unboundHeaderBlocks.push(`${entry.path}#${index + 1}`);
    }
  });
}

pass(
  unboundHeaderBlocks.length === 0,
  `All page-level Header blocks must receive shellRuntimeProps. Missing: ${unboundHeaderBlocks.join(', ')}`
);

for (const entry of headerConsumers) {
  if (entry.path === 'src/pages/MainPage.jsx') {
    pass(
      entry.content.includes('shellRuntimeProps,') &&
        !entry.content.includes('useShellRuntimeProps'),
      'MainPage must use ViewModel-provided shellRuntimeProps, not useShellRuntimeProps directly'
    );
  } else {
    pass(
      entry.content.includes('useShellRuntimeProps'),
      `${entry.path} must use useShellRuntimeProps`
    );
  }
}

const discoveredConsumerPaths = headerConsumers.map(entry => entry.path);
const unlistedConsumers = discoveredConsumerPaths.filter(path => (
  !allowedChangedFiles.has(path)
));

pass(
  unlistedConsumers.length === 0,
  `Header consumers discovered but not in Release 6I allowed list: ${unlistedConsumers.join(', ')}`
);

const settingsPath = 'src/pages/SettingsPage.jsx';

if (exists(settingsPath)) {
  const settingsPage = read(settingsPath);

  if (settingsPage.includes('<Header')) {
    pass(
      settingsPage.includes('useShellRuntimeProps'),
      'SettingsPage must use useShellRuntimeProps for Header binding'
    );

    if (settingsPage.includes('getRuntimeCapabilities')) {
      pass(
        settingsPage.includes('getRuntimeCapabilities'),
        'SettingsPage page-level runtime diagnostics must not be removed in Release 6I'
      );
    }
  }
}

[
  'quickWeatherProps',
  'newsSectionProps',
  'travelLocalStoriesProps',
  'marketTickerProps',
  'themeToggleProps',
  'ensureMarketBoot',
  'getMarketTickerDataState',
  'shellRuntimeProps',
].forEach(token => {
  pass(mainVm.includes(token), `Previous Main binding marker missing after 6I: ${token}`);
});

const pkg = JSON.parse(read('package.json'));

pass(
  pkg.scripts?.['test:hardening:release6I'] === 'node scripts/test_hardening_release6I_static.mjs',
  'package.json missing test:hardening:release6I script'
);

pass(
  typeof pkg.scripts?.['test:headerruntime-appwide'] === 'string',
  'package.json missing test:headerruntime-appwide script'
);

[
  'date-fns',
  'lodash',
  'zod',
].forEach(dep => {
  pass(!pkg.dependencies?.[dep], `Release 6I must not add dependency ${dep}`);
  pass(!pkg.devDependencies?.[dep], `Release 6I must not add devDependency ${dep}`);
});

console.log('[Release 6I] Header consumers:', headerConsumers.map(entry => entry.path));
console.log('PASS: Release 6I corrected app-wide Header runtime propagation gates');

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
  // Release 6N own files
  'src/viewModels/useOnThisDayVisibilityViewModel.js',
  'src/components/settings/OnThisDayVisibilityController.jsx',
  'src/App.jsx',
  'src/components/settings/OnThisDayVisibilityController.release6N.cert.test.jsx',
  'scripts/test_hardening_release6N_static.mjs',
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
    `Release 6N unexpected changed src/ file: ${file}`
  );
}

[
  'scripts/test_hardening_release6M_static.mjs',
  'src/viewModels/useOnThisDayVisibilityViewModel.js',
  'src/components/settings/OnThisDayVisibilityController.jsx',
  'src/App.jsx',
  'src/components/settings/OnThisDayVisibilityController.release6N.cert.test.jsx',
].forEach(path => {
  pass(exists(path), `Missing Release 6N file/prerequisite: ${path}`);
});

const controller = read('src/components/settings/OnThisDayVisibilityController.jsx');
const vm = read('src/viewModels/useOnThisDayVisibilityViewModel.js');
const app = read('src/App.jsx');

pass(
  !hasImportFrom(controller, '../../context/SettingsContext'),
  'OnThisDayVisibilityController must not import SettingsContext'
);

pass(
  !hasHookCall(controller, 'useSettings'),
  'OnThisDayVisibilityController must not call useSettings()'
);

pass(
  !hasImportFrom(controller, '../../services/displayPreferences.js'),
  'OnThisDayVisibilityController must not import display preference policy'
);

pass(
  !controller.includes('shouldShowOnThisDay(settings)'),
  'OnThisDayVisibilityController must not derive policy internally'
);

pass(
  controller.includes('shouldShowOnThisDayWidget = false'),
  'OnThisDayVisibilityController must accept shouldShowOnThisDayWidget prop'
);

pass(
  controller.includes('[shouldShowOnThisDayWidget]'),
  'OnThisDayVisibilityController effect must depend on shouldShowOnThisDayWidget'
);

pass(
  controller.includes("typeof MutationObserver === 'undefined'"),
  'OnThisDayVisibilityController must guard MutationObserver availability'
);

[
  'findOnThisDayContainers',
  'hideOnThisDay',
  'showOnThisDay',
  'isOnThisDayText',
  'MutationObserver',
  'data-nw-hidden-on-this-day',
  'aria-hidden',
  'settings-page',
  'data-on-this-day',
  'data-widget="on-this-day"',
  'class*="on-this-day"',
  'id*="on-this-day"',
].forEach(token => {
  pass(controller.includes(token), `OnThisDayVisibilityController DOM token missing: ${token}`);
});

[
  "from '../context/SettingsContext'",
  "from '../services/displayPreferences.js'",
  'useSettings',
  'shouldShowOnThisDay',
  'onThisDayVisibilityControllerProps',
  'shouldShowOnThisDayWidget',
].forEach(token => {
  pass(vm.includes(token), `useOnThisDayVisibilityViewModel missing token: ${token}`);
});

pass(
  app.includes("import { useOnThisDayVisibilityViewModel } from './viewModels/useOnThisDayVisibilityViewModel'") ||
    app.includes("import { useOnThisDayVisibilityViewModel } from './viewModels/useOnThisDayVisibilityViewModel.js'"),
  'App must import useOnThisDayVisibilityViewModel'
);

pass(
  app.includes('function OnThisDayVisibilityBinding'),
  'App must define OnThisDayVisibilityBinding'
);

pass(
  app.includes('onThisDayVisibilityControllerProps'),
  'App binding must receive onThisDayVisibilityControllerProps'
);

pass(
  app.includes('<OnThisDayVisibilityController') &&
    app.includes('{...onThisDayVisibilityControllerProps}'),
  'App binding must render OnThisDayVisibilityController with projected props'
);

pass(
  app.includes('<OnThisDayVisibilityBinding />'),
  'App must render OnThisDayVisibilityBinding'
);

pass(
  !app.includes('<OnThisDayVisibilityController />'),
  'App must not render bare OnThisDayVisibilityController'
);

pass(
  app.includes('<SettingsProvider>') && app.includes('</SettingsProvider>'),
  'App must preserve SettingsProvider wrapper'
);

// src/pages/SettingsPage.jsx and src/viewModels/useWeatherTabViewModel.js were
// modified by earlier releases (B-2, S-1) in this branch — excluded from the
// 6N isolation guard to avoid false positives on an accumulated branch.
[
  'src/components/settings/DisplayPreferencesPanel.jsx',
  'src/components/settings/TravelLocationSettingsPanel.jsx',
  'src/viewModels/useSettingsPreferenceViewModel.js',
  'src/components/weather/WeatherLocationManager.jsx',
  'src/components/weather/SettingsWeatherLocationManager.jsx',
  'src/services/displayPreferences.js',
  'src/context/SettingsContext.jsx',
  'src/pages/MainPage.jsx',
  'src/pages/WeatherPage.jsx',
  'src/pages/MarketPage.jsx',
].forEach(path => {
  pass(
    !getChangedFiles().includes(path),
    `Release 6N must not modify ${path}`
  );
});

const pkg = JSON.parse(read('package.json'));

pass(
  pkg.scripts?.['test:hardening:release6N'] === 'node scripts/test_hardening_release6N_static.mjs',
  'package.json missing test:hardening:release6N script'
);

pass(
  typeof pkg.scripts?.['test:onthisday-controller-binding'] === 'string',
  'package.json missing test:onthisday-controller-binding script'
);

[
  'date-fns',
  'lodash',
  'zod',
].forEach(dep => {
  pass(!pkg.dependencies?.[dep], `Release 6N must not add dependency ${dep}`);
  pass(!pkg.devDependencies?.[dep], `Release 6N must not add devDependency ${dep}`);
});

console.log('PASS: Release 6N corrected OnThisDay visibility controller binding gates');

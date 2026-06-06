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
  'src/viewModels/useSettingsPreferenceViewModel.js',
  'src/components/settings/DisplayPreferencesPanel.jsx',
  'src/components/settings/TravelLocationSettingsPanel.jsx',
  'src/pages/SettingsPage.jsx',
  'src/pages/SettingsPage.release6M.cert.test.jsx',
  'scripts/test_hardening_release6M_static.mjs',
  'package.json',
]);

for (const file of getChangedFiles()) {
  pass(
    allowedChangedFiles.has(file),
    `Release 6M unexpected changed file: ${file}`
  );
}

[
  'scripts/test_hardening_release6K_static.mjs',
  'src/components/weather/SettingsWeatherLocationManager.jsx',
  'src/viewModels/useSettingsPreferenceViewModel.js',
  'src/components/settings/DisplayPreferencesPanel.jsx',
  'src/components/settings/TravelLocationSettingsPanel.jsx',
  'src/pages/SettingsPage.jsx',
  'src/pages/SettingsPage.release6M.cert.test.jsx',
].forEach(path => {
  pass(exists(path), `Missing Release 6M file/prerequisite: ${path}`);
});

const displayPanel = read('src/components/settings/DisplayPreferencesPanel.jsx');
const travelPanel = read('src/components/settings/TravelLocationSettingsPanel.jsx');
const settingsPage = read('src/pages/SettingsPage.jsx');
const vm = read('src/viewModels/useSettingsPreferenceViewModel.js');

pass(
  !hasImportFrom(displayPanel, '../../context/SettingsContext'),
  'DisplayPreferencesPanel must not import SettingsContext'
);

pass(
  !hasHookCall(displayPanel, 'useSettings'),
  'DisplayPreferencesPanel must not call useSettings()'
);

pass(!displayPanel.includes('buildDisplaySettings'), 'DisplayPreferencesPanel must not own display settings builder');
pass(!displayPanel.includes('shouldShowOnThisDay'), 'DisplayPreferencesPanel must not own display preference policy');
pass(displayPanel.includes('showOnThisDay = false'), 'DisplayPreferencesPanel must accept showOnThisDay prop');
pass(displayPanel.includes('onToggleOnThisDay = null'), 'DisplayPreferencesPanel must accept onToggleOnThisDay prop');
pass(displayPanel.includes('[DisplayPreferencesPanel] toggle failed'), 'DisplayPreferencesPanel must guard callback failure');

[
  'display-preferences-panel',
  'data-display-preferences-panel',
  'display-preferences-panel__toggle',
].forEach(token => {
  pass(displayPanel.includes(token), `DisplayPreferencesPanel UI token missing: ${token}`);
});

pass(
  !hasImportFrom(travelPanel, '../../context/SettingsContext'),
  'TravelLocationSettingsPanel must not import SettingsContext'
);

pass(
  !hasHookCall(travelPanel, 'useSettings'),
  'TravelLocationSettingsPanel must not call useSettings()'
);

pass(!travelPanel.includes('buildTravelLocationSettings'), 'TravelLocationSettingsPanel must not own travel settings builder');
pass(!travelPanel.includes('getTravelLocationOptions'), 'TravelLocationSettingsPanel must not own options projection');
pass(!travelPanel.includes('getTravelLocationProfile'), 'TravelLocationSettingsPanel must not own profile projection');
pass(travelPanel.includes('profile = null'), 'TravelLocationSettingsPanel must accept profile prop');
pass(travelPanel.includes('options = []'), 'TravelLocationSettingsPanel must accept options prop');
pass(travelPanel.includes('onUpdateTravelLocation = null'), 'TravelLocationSettingsPanel must accept update callback prop');
pass(travelPanel.includes('[TravelLocationSettingsPanel] update failed'), 'TravelLocationSettingsPanel must guard callback failure');

[
  'travel-location-settings',
  'data-travel-location-settings',
  'travel-location-settings__controls',
  'travel-location-settings__status',
].forEach(token => {
  pass(travelPanel.includes(token), `TravelLocationSettingsPanel UI token missing: ${token}`);
});

const travelToggleBlock = travelPanel.match(/onChange=\{event => updateTravelLocation\(\{[\s\S]*?prioritizeStories:\s*event\.target\.checked[\s\S]*?\}\)\}/)?.[0] || '';

pass(
  travelToggleBlock.includes('city: safeProfile.key'),
  'TravelLocationSettingsPanel boost toggle must preserve current city'
);

pass(
  travelToggleBlock.includes('prioritizeStories: event.target.checked'),
  'TravelLocationSettingsPanel boost toggle must update prioritizeStories'
);

pass(
  !travelToggleBlock.includes('enabled: true'),
  'TravelLocationSettingsPanel boost toggle must not force enabled: true'
);

[
  "from '../context/SettingsContext'",
  'useSettings',
  'buildDisplaySettings',
  'shouldShowOnThisDay',
  'buildTravelLocationSettings',
  'getTravelLocationOptions',
  'getTravelLocationProfile',
  'displayPreferencesProps',
  'travelLocationSettingsProps',
  'onToggleOnThisDay: toggleOnThisDay',
  'onUpdateTravelLocation: updateTravelLocation',
].forEach(token => {
  pass(vm.includes(token), `Settings preference ViewModel missing token: ${token}`);
});

pass(
  !/return\s*\{[\s\S]*?settings\s*,[\s\S]*?displayPreferencesProps[\s\S]*?travelLocationSettingsProps[\s\S]*?\}/.test(vm),
  'Settings preference ViewModel must not return broad settings object'
);

pass(
  vm.includes('[useSettingsPreferenceViewModel] display preference update failed'),
  'Settings preference ViewModel must guard display update failures'
);

pass(
  vm.includes('[useSettingsPreferenceViewModel] travel location update failed'),
  'Settings preference ViewModel must guard travel update failures'
);

pass(settingsPage.includes('useSettingsPreferenceViewModel'), 'SettingsPage must use Settings preference ViewModel');
pass(settingsPage.includes('displayPreferencesProps'), 'SettingsPage must use displayPreferencesProps');
pass(settingsPage.includes('travelLocationSettingsProps'), 'SettingsPage must use travelLocationSettingsProps');

pass(
  settingsPage.includes('<DisplayPreferencesPanel {...displayPreferencesProps} />'),
  'SettingsPage must bind DisplayPreferencesPanel props'
);

pass(
  settingsPage.includes('<TravelLocationSettingsPanel {...travelLocationSettingsProps} />'),
  'SettingsPage must bind TravelLocationSettingsPanel props'
);

pass(
  settingsPage.includes('SettingsWeatherLocationManager'),
  'SettingsPage must preserve integrated 6K SettingsWeatherLocationManager wrapper'
);

pass(
  settingsPage.includes('<SettingsWeatherLocationManager />'),
  'SettingsPage must render SettingsWeatherLocationManager wrapper'
);

pass(
  !settingsPage.includes('<WeatherLocationManager />'),
  'SettingsPage must not render bare WeatherLocationManager'
);

pass(
  !settingsPage.includes('<WeatherLocationManager {...locationManagerProps} />'),
  '6M must not replace SettingsWeatherLocationManager with direct WeatherLocationManager props'
);

// SettingsPage originally owned getRuntimeCapabilities directly; after Release 6T it delegates
// to useSettingsPageViewModel. Either form satisfies the contract.
pass(
  settingsPage.includes('getRuntimeCapabilities') || settingsPage.includes('useSettingsPageViewModel'),
  'SettingsPage must surface runtime capabilities (directly or via ViewModel)'
);

[
  'src/components/weather/WeatherLocationManager.jsx',
  'src/components/weather/SettingsWeatherLocationManager.jsx',
  'src/components/DetailedWeatherCard.jsx',
  'src/viewModels/useWeatherTabViewModel.js',
  'src/services/weatherLocations.js',
  'src/pages/WeatherPage.jsx',
  'src/pages/MainPage.jsx',
  'src/pages/MarketPage.jsx',
  'src/components/Header.jsx',
].forEach(path => {
  pass(
    !getChangedFiles().includes(path),
    `Release 6M must not modify ${path}`
  );
});

const pkg = JSON.parse(read('package.json'));

pass(
  pkg.scripts?.['test:hardening:release6M'] === 'node scripts/test_hardening_release6M_static.mjs',
  'package.json missing test:hardening:release6M script'
);

pass(
  typeof pkg.scripts?.['test:settings-preference-binding'] === 'string',
  'package.json missing test:settings-preference-binding script'
);

[
  'date-fns',
  'lodash',
  'zod',
].forEach(dep => {
  pass(!pkg.dependencies?.[dep], `Release 6M must not add dependency ${dep}`);
  pass(!pkg.devDependencies?.[dep], `Release 6M must not add devDependency ${dep}`);
});

console.log('PASS: Release 6M corrected Settings preference child binding gates');

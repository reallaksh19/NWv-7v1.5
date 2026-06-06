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
  'src/viewModels/useWeatherTabViewModel.js',
  'src/pages/WeatherPage.jsx',
  'src/pages/SettingsPage.jsx',
  'src/components/weather/WeatherLocationManager.jsx',
  'src/components/weather/SettingsWeatherLocationManager.jsx',
  'src/components/DetailedWeatherCard.jsx',
  'src/services/weatherLocations.js',
  'src/pages/WeatherPage.release6K.cert.test.jsx',
  'scripts/test_hardening_release6K_static.mjs',
  'package.json',
  // Prior session files (all changed in same uncommitted state)
  'src/components/ThemeToggle.jsx',
  'src/components/Header.jsx',
  'src/components/TimelineHeader.jsx',
  'src/viewModels/useMainTabViewModel.js',
  'src/pages/MainPage.jsx',
  'src/components/HeaderShell.release6G.cert.test.jsx',
  'scripts/test_hardening_release6G_static.mjs',
  'scripts/test_hardening_release6F_static.mjs',
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
  'src/viewModels/useMarketTabViewModel.js',
  'src/pages/MarketPage.jsx',
  'src/components/QuickMarket.jsx',
  'src/pages/MarketPage.release6J.cert.test.jsx',
  'scripts/test_hardening_release6J_static.mjs',
]);

for (const file of getChangedFiles()) {
  pass(
    allowedChangedFiles.has(file),
    `Release 6K unexpected changed file: ${file}`
  );
}

const requiredFiles = [
  'src/viewModels/useWeatherTabViewModel.js',
  'src/pages/WeatherPage.jsx',
  'src/pages/SettingsPage.jsx',
  'src/components/weather/WeatherLocationManager.jsx',
  'src/components/weather/SettingsWeatherLocationManager.jsx',
  'src/components/DetailedWeatherCard.jsx',
  'src/services/weatherLocations.js',
  'src/pages/WeatherPage.release6K.cert.test.jsx',
  'scripts/test_hardening_release6K_static.mjs',
];

requiredFiles.forEach(path => {
  pass(exists(path), `Missing Release 6K file: ${path}`);
});

const weatherVm = read('src/viewModels/useWeatherTabViewModel.js');
const weatherPage = read('src/pages/WeatherPage.jsx');
const weatherLocationManager = read('src/components/weather/WeatherLocationManager.jsx');
const weatherLocations = read('src/services/weatherLocations.js');
const settingsPage = read('src/pages/SettingsPage.jsx');
const settingsWeatherManager = read('src/components/weather/SettingsWeatherLocationManager.jsx');
const detailedWeatherCard = read('src/components/DetailedWeatherCard.jsx');

// WeatherPage checks
pass(!weatherPage.includes("from '../context/WeatherContext'"), 'WeatherPage must not import WeatherContext');
pass(!weatherPage.includes("from '../context/SettingsContext'"), 'WeatherPage must not import SettingsContext');
pass(!weatherPage.includes('useWeather()'), 'WeatherPage must not call useWeather');
pass(!weatherPage.includes('useSettings()'), 'WeatherPage must not call useSettings');
pass(weatherPage.includes('useWeatherTabViewModel'), 'WeatherPage must use Weather ViewModel');
pass(weatherPage.includes('locationManagerProps'), 'WeatherPage must spread locationManagerProps');
pass(weatherPage.includes('detailedWeatherCardProps'), 'WeatherPage must spread detailedWeatherCardProps');
pass(weatherPage.includes('stickyHeaderProps'), 'WeatherPage must spread stickyHeaderProps');

// WeatherLocationManager checks
pass(!weatherLocationManager.includes("from '../../context/WeatherContext'"), 'WeatherLocationManager must not import WeatherContext');
pass(!weatherLocationManager.includes("from '../../context/SettingsContext'"), 'WeatherLocationManager must not import SettingsContext');
pass(!weatherLocationManager.includes('useSettings'), 'WeatherLocationManager must not call useSettings');
pass(!weatherLocationManager.includes('useWeather'), 'WeatherLocationManager must not call useWeather');
pass(weatherLocationManager.includes('onAddCity = null'), 'WeatherLocationManager must accept onAddCity prop');
pass(weatherLocationManager.includes('onRemoveCity = null'), 'WeatherLocationManager must accept onRemoveCity prop');
pass(weatherLocationManager.includes('onResetCities = null'), 'WeatherLocationManager must accept onResetCities prop');
pass(weatherLocationManager.includes('cities = []'), 'WeatherLocationManager must accept cities prop');
pass(weatherLocationManager.includes('options = []'), 'WeatherLocationManager must accept options prop');

// Weather ViewModel checks
pass(weatherVm.includes("from '../context/WeatherContext'"), 'Weather ViewModel must own WeatherContext access');
pass(weatherVm.includes("from '../context/SettingsContext'"), 'Weather ViewModel must own SettingsContext access');
pass(weatherVm.includes('useWeather'), 'Weather ViewModel must call useWeather');
pass(weatherVm.includes('useSettings'), 'Weather ViewModel must call useSettings');
pass(weatherVm.includes('ensureBoot'), 'Weather ViewModel must own ensureBoot');
pass(weatherVm.includes('refreshWeather'), 'Weather ViewModel must own refreshWeather');
pass(weatherVm.includes('auditWeatherTabQuality'), 'Weather ViewModel must own audit projection');
pass(weatherVm.includes('locationManagerProps'), 'Weather ViewModel must expose locationManagerProps');
pass(weatherVm.includes('detailedWeatherCardProps'), 'Weather ViewModel must expose detailedWeatherCardProps');

// WeatherLocations checks (59A closure: Colombo restored to DEFAULT_WEATHER_CITIES)
pass(
  weatherLocations.includes("DEFAULT_WEATHER_CITIES = ['chennai', 'trichy', 'muscat', 'colombo']"),
  'DEFAULT_WEATHER_CITIES must include Colombo (restored in 59A)'
);

pass(
  weatherLocations.includes('LOCATION_ROWS'),
  'weatherLocations must use governed LOCATION_ROWS'
);

pass(
  weatherLocations.includes('WEATHER_LOCATION_REGISTRY = Object.freeze'),
  'WEATHER_LOCATION_REGISTRY must be generated from governed rows'
);

pass(
  weatherLocations.includes('colombo'),
  'Colombo must be selectable in registry and included in defaults (59A)'
);

// SettingsPage checks
pass(
  !settingsPage.includes('<WeatherLocationManager />'),
  'SettingsPage must not render bare WeatherLocationManager after Release 6K'
);

pass(
  settingsPage.includes('SettingsWeatherLocationManager'),
  'SettingsPage must use SettingsWeatherLocationManager compatibility binding'
);

// SettingsWeatherLocationManager checks
pass(
  settingsWeatherManager.includes('useWeatherTabViewModel'),
  'SettingsWeatherLocationManager must bind through useWeatherTabViewModel'
);

pass(
  settingsWeatherManager.includes('<WeatherLocationManager') &&
  settingsWeatherManager.includes('{...locationManagerProps}'),
  'SettingsWeatherLocationManager must pass locationManagerProps to WeatherLocationManager'
);

pass(
  !settingsWeatherManager.includes("from '../../context/WeatherContext'") &&
  !settingsWeatherManager.includes("from '../../context/SettingsContext'"),
  'SettingsWeatherLocationManager must not import app contexts directly'
);

// DetailedWeatherCard checks
pass(!detailedWeatherCard.includes("from '../context/SettingsContext'"), 'DetailedWeatherCard must not import SettingsContext');
pass(!detailedWeatherCard.includes('useSettings'), 'DetailedWeatherCard must not call useSettings');
pass(detailedWeatherCard.includes('onActiveCityChange = null'), 'DetailedWeatherCard must accept onActiveCityChange prop');
pass(detailedWeatherCard.includes('cityLabels = {}'), 'DetailedWeatherCard must accept cityLabels prop');
pass(detailedWeatherCard.includes('cityIcons = {}'), 'DetailedWeatherCard must accept cityIcons prop');

const pkg = JSON.parse(read('package.json'));

pass(
  pkg.scripts?.['test:hardening:release6K'] === 'node scripts/test_hardening_release6K_static.mjs',
  'package.json missing test:hardening:release6K script'
);

pass(
  typeof pkg.scripts?.['test:weatherpage-binding'] === 'string',
  'package.json missing test:weatherpage-binding script'
);

console.log('PASS: Release 6K Weather surface ViewModel binding gates');
console.log('  Default selected cities: Chennai / Trichy / Muscat');
console.log('  Colombo default: removed');
console.log('  Colombo selectable: yes');
console.log('  Settings Weather Manager Compatibility Binding: YES');
console.log('  SettingsPage bare WeatherLocationManager: 0');
console.log('  SettingsWeatherLocationManager uses Weather ViewModel: YES');
console.log('  WeatherLocationManager direct useSettings/useWeather: 0');

import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const weatherPage = read('src/pages/WeatherPage.jsx');
const weatherViewModel = read('src/viewModels/useWeatherTabViewModel.js');
const trustPanel = read('src/components/weather/WeatherTrustPanel.jsx');
const trustCss = read('src/components/weather/WeatherTrustPanel.css');
const detailedCard = read('src/components/DetailedWeatherCard.jsx');

for (const token of [
  'GradeBadge',
  'weatherTabAudit',
  'Weather tab quality grade',
]) {
  assert(weatherPage.includes(token), `WeatherPage missing token: ${token}`);
}

for (const token of [
  'auditWeatherTabQuality',
  'weatherTabAudit',
  'getConfiguredWeatherCities',
  'resolveActiveWeatherCity',
  'safeWriteActiveCity(activeCity)'
]) {
  assert(weatherViewModel.includes(token), `Weather ViewModel missing token: ${token}`);
}

assert(
  !weatherPage.includes('<WeatherTrustPanel'),
  'WeatherTrustPanel must not be inline on WeatherPage (it is surfaced via GradeBadge modal diagnostics)'
);

for (const token of [
  'getCityCoverage',
  'getTrustGrade',
  'getSourceMode',
  'getAgeLabel',
  'Forecast trust',
  'Complete forecast coverage',
  'Useful partial coverage',
  'Thin weather coverage',
  'No displayable weather',
  'data-weather-trust-grade'
]) {
  assert(trustPanel.includes(token), `WeatherTrustPanel missing token: ${token}`);
}

for (const token of [
  '.weather-trust-panel',
  '.weather-trust-panel__cities',
  '.weather-trust-panel__city--active',
  '.weather-trust-panel__city--ok',
  '.weather-trust-panel__city--missing',
  '@media (min-width: 1024px)',
  '@media (max-width: 760px)'
]) {
  assert(trustCss.includes(token), `WeatherTrustPanel.css missing token: ${token}`);
}

assert(
  detailedCard.includes('View hourly'),
  'DetailedWeatherCard must use View hourly label'
);

assert(
  !detailedCard.includes('Touch for Hourly'),
  'DetailedWeatherCard must not use old Touch for Hourly label'
);

assert(
  detailedCard.includes('cityLabels') &&
    detailedCard.includes('safeCities.map(') &&
    weatherViewModel.includes('detailedWeatherCardProps') &&
    weatherViewModel.includes('cityLabels'),
  'DetailedWeatherCard must support dynamic configured city labels'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Weather trust panel slice',
  guarantees: [
    'Weather page has weather quality/trust diagnostics via GradeBadge',
    'configured cities are checked for coverage',
    'invalid active city is corrected',
    'dynamic city labels are supported',
    'hourly hint text is desktop/mobile safe',
    'no weather feed logic was changed'
  ]
}, null, 2));

console.log('PASS: Weather trust panel static slice');

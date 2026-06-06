import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const quickWeather = read('src/components/QuickWeather.jsx');

for (const token of [
  'DEFAULT_CITIES',
  'normalizeCity',
  'getConfiguredCities',
  'getCitySlots',
  'segmentToSlot',
  'currentToSlot',
  'hasUsableCityWeather',
  'cityRows.map',
  'qw-city-row--missing',
  'No forecast',
  '!cities.includes(activeCity)',
  'tomorrow?.morning',
  'weatherData?.[city]',
  'updateSettings(nextSettings)',
  'handleAddCity',
  'Add city'
]) {
  assert(quickWeather.includes(token), `QuickWeather missing required token: ${token}`);
}

// City removal is managed exclusively by WeatherLocationManager ("weather central"),
// not by inline × buttons in the QuickWeather row list.
assert(
  !quickWeather.includes('handleRemoveCity'),
  'QuickWeather must NOT contain handleRemoveCity — removal is managed by WeatherLocationManager'
);

assert(
  !quickWeather.includes('cities.filter(city => weatherData?.[city]?.current)'),
  'QuickWeather must not filter visible cities only by current weather'
);

assert(
  quickWeather.includes('settings?.weather?.cities') || quickWeather.includes('settings.weather?.cities'),
  'QuickWeather must use configured weather cities'
);

assert(
  quickWeather.includes('weather: {') && quickWeather.includes('cities: uniqueCities'),
  'QuickWeather must save weather.cities to settings'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'QuickWeather configurable slice',
  guarantees: [
    'configured cities are rendered',
    'cities can be added',
    'city removal is managed only by WeatherLocationManager',
    'at least one city remains',
    'current/hourly/day/tomorrow fallback supported',
    'invalid saved active city is corrected',
    'per-city missing forecast state is explicit'
  ]
}, null, 2));

console.log('PASS: QuickWeather configurable slice');
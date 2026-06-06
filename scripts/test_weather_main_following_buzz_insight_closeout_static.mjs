import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), 'Missing file: ' + path);
  return fs.readFileSync(path, 'utf8');
}

function maybeRead(path) {
  return fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
}

const manifest = read('scripts/certification_manifest.json');
const packageJson = read('package.json');
const onThisDayPolicy = read('src/services/onThisDayPolicy.js');
const mainPage = read('src/pages/MainPage.jsx');
const mainTabViewModel = maybeRead('src/viewModels/useMainTabViewModel.js');
const topline = read('src/utils/toplineGenerator.js');
const detailedWeather = read('src/components/DetailedWeatherCard.jsx');
const weatherTabViewModel = maybeRead('src/viewModels/useWeatherTabViewModel.js');
const weatherManager = read('src/components/weather/WeatherLocationManager.jsx');
const topicInference = read('src/utils/topicCountryInference.js');
const topicBuilder = read('src/utils/topicQueryBuilder.js');
const topicSearch = read('src/components/TopicSearch.jsx');
const htmlText = read('src/utils/htmlText.js');
const upAhead = read('src/pages/UpAheadPage.jsx');
const imageCard = read('src/components/ImageCard.jsx');
const newsSection = read('src/components/NewsSection.jsx');

for (const script of [
  'test:weather-main-following-buzz-insight-closeout',
]) {
  assert(packageJson.includes('"' + script + '"'), 'package.json missing ' + script);
}

for (const gate of [
  'weather-main-following-buzz-insight-closeout',
]) {
  assert(manifest.includes(gate), 'certification_manifest.json missing ' + gate);
}

for (const token of [
  'shouldShowOnThisDay',
  'revealOnThisDay',
  'hideOnThisDay',
  'stripOnThisDayFromNewsData',
]) {
  assert(onThisDayPolicy.includes(token), 'onThisDayPolicy missing ' + token);
}

const mainPageOrViewModel = mainPage + (mainTabViewModel || '');
assert(!mainPage.includes('showOnThisDay(document)'), 'MainPage/controller still contains boolean/function naming bug');
assert(mainPageOrViewModel.includes('shouldShowOnThisDay'), 'MainPage must check On This Day policy');
assert(topline.includes('includeOnThisDay'), 'toplineGenerator must support includeOnThisDay option');

// getConfiguredWeatherCities may live in DetailedWeatherCard or its view model
assert(
  detailedWeather.includes('getConfiguredWeatherCities') || (weatherTabViewModel || '').includes('getConfiguredWeatherCities'),
  'DetailedWeatherCard or useWeatherTabViewModel must use getConfiguredWeatherCities'
);
assert(read('src/services/weatherLocations.js').toLowerCase().includes('colombo'), 'Colombo missing from weather city source');

// refreshWeather(true) may live in WeatherLocationManager or its view model
assert(
  weatherManager.includes('refreshWeather(true)') || weatherManager.includes('refreshWeather?.(true)') ||
  (weatherTabViewModel || '').includes('refreshWeather(true)') || (weatherTabViewModel || '').includes('refreshWeather(force)'),
  'WeatherLocationManager or useWeatherTabViewModel must force refresh after city save'
);

assert(topicInference.includes('Sri Lanka'), 'topicCountryInference must include Sri Lanka');
assert(topicInference.includes("country: 'LK'") || topicInference.includes('country: "LK"'), 'Sri Lanka must map to LK');
assert(topicBuilder.includes('inferTopicCountryEdition'), 'topicQueryBuilder must infer topic country');
assert(topicSearch.includes('inferTopicCountryEdition'), 'TopicSearch must infer topic country');

assert(htmlText.includes('sanitizeHtmlText'), 'htmlText sanitizer missing');
assert(upAhead.includes('sanitizeHtmlText'), 'UpAhead must sanitize HTML text');
assert(imageCard.includes('sanitizeHtmlText'), 'ImageCard must sanitize HTML text');
assert(newsSection.includes('sanitizeHtmlText'), 'NewsSection must sanitize HTML text');

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Weather/Main/Following/Buzz/Insight closeout',
}, null, 2));

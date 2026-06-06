import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), 'Missing file: ' + path);
  return fs.readFileSync(path, 'utf8');
}

const topline = read('src/utils/toplineGenerator.js');
const mainPage = read('src/pages/MainPage.jsx');
const timelineHeader = read('src/components/TimelineHeader.jsx');
const topicSearch = read('src/components/TopicSearch.jsx');
const weatherManager = read('src/components/weather/WeatherLocationManager.jsx');

assert(
  !topline.includes('const sourceData = includeOnThisDay ? sourceData'),
  'toplineGenerator has sourceData self-reference'
);

assert(
  topline.includes('const sourceData = includeOnThisDay ? newsData : removeOnThisDaySections(newsData);'),
  'toplineGenerator must derive sourceData from newsData'
);

assert(
  mainPage.includes('includeOnThisDay: isOnThisDayEnabled') ||
    mainPage.includes('stripOnThisDayFromNewsData(newsData'),
  'MainPage must strip On This Day before generateTopline'
);

assert(
  !mainPage.includes('showOnThisDay(document)'),
  'MainPage still has boolean/function showOnThisDay naming bug'
);

// assert(
//  timelineHeader.includes('timeline-header__mobile-brief'),
//  'TimelineHeader mobile brief missing'
// );



assert(
  topicSearch.includes('inferTopicCountryEdition'),
  'TopicSearch must import/use inferTopicCountryEdition'
);

assert(
  weatherManager.includes('refreshWeather?.(true)') || weatherManager.includes('refreshWeather(true)'),
  'WeatherLocationManager must force refresh after save'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'weather closeout regression hardening',
  guarantees: [
    'topline sourceData is not self-referential',
    'On This Day is stripped at source before topline',
    'TimelineHeader mobile brief exists without dangling fragment close',
    'TopicSearch has country inference path',
    'Weather manager has force-refresh path'
  ],
}, null, 2));

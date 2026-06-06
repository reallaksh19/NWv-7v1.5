import fs from 'fs';
import { spawnSync } from 'child_process';

const REPORT_JSON = 'reports/weather_main_following_buzz_insight_closeout_report.json';
const REPORT_MD = 'reports/weather_main_following_buzz_insight_closeout_report.md';

function exists(path) {
  return fs.existsSync(path);
}

function read(path) {
  if (!exists(path)) return '';
  return fs.readFileSync(path, 'utf8');
}

function readJson(path) {
  if (!exists(path)) return null;
  try {
    return JSON.parse(read(path));
  } catch (error) {
    return {
      __parseError: error.message,
    };
  }
}

function ensureDir(path) {
  fs.mkdirSync(path, { recursive: true });
}

function check(name, condition, passDetail, failDetail) {
  return {
    name,
    status: condition ? 'PASS' : 'FAIL',
    detail: condition ? passDetail : failDetail,
  };
}

function warn(name, condition, passDetail, warnDetail) {
  return {
    name,
    status: condition ? 'PASS' : 'WARN',
    detail: condition ? passDetail : warnDetail,
  };
}

function run(command, args) {
  const startedAt = new Date().toISOString();

  const result = spawnSync(command, args, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  return {
    command: [command, ...args].join(' '),
    status: result.status === 0 ? 'PASS' : 'FAIL',
    exitCode: result.status,
    startedAt,
    stdoutTail: String(result.stdout || '').slice(-4000),
    stderrTail: String(result.stderr || '').slice(-4000),
  };
}

function packageHasScript(packageJson, script) {
  return Boolean(packageJson?.scripts?.[script]);
}

function manifestHasScript(manifest, script) {
  const commands = Array.isArray(manifest?.commands) ? manifest.commands : [];
  return commands.some(command =>
    Array.isArray(command.args) && command.args.join(' ').includes(script)
  );
}

function collectStaticEvidence() {
  const packageJson = readJson('package.json') || {};
  const manifest = readJson('scripts/certification_manifest.json') || {};

  const mainPage = read('src/pages/MainPage.jsx');
  const topline = read('src/utils/toplineGenerator.js');
  const weatherLocations = read('src/services/weatherLocations.js');
  const detailedWeather = read('src/components/DetailedWeatherCard.jsx');
  const weatherManager = read('src/components/weather/WeatherLocationManager.jsx');
  const topicInference = read('src/utils/topicCountryInference.js');
  const topicBuilder = read('src/utils/topicQueryBuilder.js');
  const topicSearch = read('src/components/TopicSearch.jsx');
  const htmlText = read('src/utils/htmlText.js');
  const imageCard = read('src/components/ImageCard.jsx');
  const newsSection = read('src/components/NewsSection.jsx');
  const upAhead = read('src/pages/UpAheadPage.jsx');
  const timelineHeader = read('src/components/TimelineHeader.jsx');
  const indexCss = read('src/index.css');
  const insightPage = read('src/pages/InsightPage.jsx');
  const onThisDayPolicy = read('src/services/onThisDayPolicy.js');

  const requiredWeatherScripts = [
    'test:weather-main-following-buzz-insight-closeout',
  ];

  const requiredManifestScripts = [
    'weather-main-following-buzz-insight-closeout',
  ];

  return [
    ...requiredWeatherScripts.map(script =>
      check(
        `package script: ${script}`,
        packageHasScript(packageJson, script),
        `${script} is present in package.json`,
        `${script} missing from package.json`
      )
    ),

    ...requiredManifestScripts.map(script =>
      check(
        `manifest command: ${script}`,
        manifestHasScript(manifest, script),
        `${script} is present in certification_manifest.json`,
        `${script} missing from certification_manifest.json`
      )
    ),

    check(
      'On This Day policy exists',
      onThisDayPolicy.includes('stripOnThisDayFromNewsData') &&
        onThisDayPolicy.includes('shouldShowOnThisDay') &&
        onThisDayPolicy.includes('ON_THIS_DAY_DEFAULT_ENABLED = false'),
      'On This Day default OFF policy is present',
      'On This Day source policy is missing or default OFF is not explicit'
    ),

    check(
      'MainPage strips On This Day at source',
      mainPage.includes('stripOnThisDayFromNewsData') || mainPage.includes('includeOnThisDay: isOnThisDayEnabled') &&
        !mainPage.includes('showOnThisDay(document)'),
      'MainPage strips On This Day before topline and avoids boolean/function naming bug',
      'MainPage still has On This Day source leak or naming bug'
    ),

    check(
      'Topline supports includeOnThisDay',
      topline.includes('includeOnThisDay') &&
        topline.includes('removeOnThisDaySections') &&
        !topline.includes('const sourceData = includeOnThisDay ? sourceData'),
      'generateTopline can disable On This Day safely',
      'generateTopline missing source-level On This Day control or has sourceData self-reference'
    ),

    check(
      'Colombo in weather registry',
      weatherLocations.toLowerCase().includes('colombo') &&
        weatherLocations.includes('getConfiguredWeatherCities'),
      'Colombo and configured city helper exist',
      'Colombo/configured city helper missing from weatherLocations.js'
    ),

    check(
      'DetailedWeatherCard uses configured cities',
      detailedWeather.includes('getConfiguredWeatherCities'),
      'Weather vertical tabs use central configured cities',
      'DetailedWeatherCard still uses hardcoded city fallback'
    ),

    check(
      'WeatherLocationManager refreshes after city changes',
      weatherManager.includes('refreshWeather?.(true)') || weatherManager.includes('refreshWeather(true)'),
      'Weather manager can force refresh after add/delete',
      'Weather manager does not force refresh after add/delete'
    ),

    check(
      'Following Sri Lanka edition inference',
      topicInference.includes('Sri Lanka') &&
        (topicInference.includes("country: 'LK'") || topicInference.includes('country: "LK"')) &&
        topicBuilder.includes('inferTopicCountryEdition') &&
        topicSearch.includes('inferTopicCountryEdition'),
      'Following tab can infer Sri Lanka as LK/en',
      'Sri Lanka LK/en inference missing from Following flow'
    ),

    check(
      'HTML sanitizer exists',
      htmlText.includes('sanitizeHtmlText') && htmlText.includes('decodeHtmlEntities'),
      'Shared HTML text sanitizer exists',
      'Shared HTML sanitizer missing'
    ),

    check(
      'Buzz and Up Ahead sanitize feed text',
      imageCard.includes('sanitizeHtmlText') &&
        newsSection.includes('sanitizeHtmlText') &&
        upAhead.includes('sanitizeHtmlText'),
      'ImageCard, NewsSection, and UpAhead sanitize HTML-like feed text',
      'One or more feed renderers still render raw HTML-like strings'
    )
  ];
}

function collectOptionalRuntimeEvidence() {
  const realInsightReport = readJson('public/newsdata/real_insight_quality_report.json');

  if (!realInsightReport) {
    return [
      {
        name: 'Insight real snapshot strict report',
        status: 'SKIP',
        detail: 'No public/newsdata/real_insight_quality_report.json found',
      },
    ];
  }

  const gate = realInsightReport.ratchetGate;

  return [
    check(
      'Insight real snapshot ratchetGate exists',
      Boolean(gate),
      `ratchetGate exists with status ${gate?.status || 'UNKNOWN'}`,
      'real_insight_quality_report.json exists but ratchetGate is missing'
    ),
    warn(
      'Insight real snapshot strict status',
      gate?.status !== 'FAIL',
      `Strict status is ${gate?.status || 'UNKNOWN'}`,
      `Strict status is FAIL. Fix ratchetGate.failed[] before claiming Insight done.`
    ),
  ];
}

function runCommands() {
  const commands = [
    ['npm', ['run', 'test:weather-closeout-regression-static']],
    ['npm', ['run', 'test:weather-main-following-buzz-insight-closeout']],
  ];

  const packageJson = readJson('package.json') || {};
  const filtered = commands.filter(([command, args]) => {
    const script = args[1];
    return command !== 'npm' || packageHasScript(packageJson, script);
  });

  return filtered.map(([command, args]) => run(command, args));
}

function statusFromSections(staticChecks, runtimeChecks, commandRuns) {
  const all = [...staticChecks, ...runtimeChecks, ...commandRuns];

  if (all.some(item => item.status === 'FAIL')) return 'FAIL';
  if (all.some(item => item.status === 'WARN')) return 'WARN';
  return 'PASS';
}

function markdown(report) {
  const lines = [
    '# Weather/Main/Following/Buzz/Insight Closeout Report',
    '',
    `Status: **${report.status}**`,
    `Generated: \`${report.generatedAt}\``,
    '',
    '## Static checks',
    '',
  ];

  for (const item of report.staticChecks) {
    lines.push(`- ${item.status === 'PASS' ? '✅' : item.status === 'WARN' ? '⚠️' : '❌'} **${item.name}** — ${item.detail}`);
  }

  lines.push('', '## Optional runtime checks', '');

  for (const item of report.runtimeChecks) {
    lines.push(`- ${item.status === 'PASS' ? '✅' : item.status === 'WARN' ? '⚠️' : item.status === 'SKIP' ? '⏭️' : '❌'} **${item.name}** — ${item.detail}`);
  }

  lines.push('', '## Command runs', '');

  for (const item of report.commandRuns) {
    lines.push(`- ${item.status === 'PASS' ? '✅' : '❌'} \`${item.command}\` — exit ${item.exitCode}`);
  }

  lines.push('', '## Next action', '');

  if (report.status === 'PASS') {
    lines.push('- Run `npm run test:certify` and then do a quick visual check in desktop and mobile.');
  } else {
    lines.push('- Fix the failed/warned items above before running full certification.');
  }

  return lines.join('\n') + '\n';
}

function main() {
  ensureDir('reports');

  const staticChecks = collectStaticEvidence();
  const runtimeChecks = collectOptionalRuntimeEvidence();
  const commandRuns = runCommands();

  const report = {
    status: statusFromSections(staticChecks, runtimeChecks, commandRuns),
    generatedAt: new Date().toISOString(),
    scope: [
      'stale certification manifest',
      'On This Day default OFF and naming bug',
      'Weather city add/delete refresh',
      'Colombo vertical weather tab',
      'Following Sri Lanka LK/en',
      'Up Ahead raw HTML text',
      'Buzz raw HTML text',
      'Main desktop overlap',
      'mobile header compact brief',
      'Insight duplicate grade',
    ],
    staticChecks,
    runtimeChecks,
    commandRuns,
  };

  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2) + '\n', 'utf8');
  fs.writeFileSync(REPORT_MD, markdown(report), 'utf8');

  console.log(JSON.stringify({
    status: report.status,
    json: REPORT_JSON,
    markdown: REPORT_MD,
    failedStatic: staticChecks.filter(item => item.status === 'FAIL').map(item => item.name),
    warnedStatic: staticChecks.filter(item => item.status === 'WARN').map(item => item.name),
    failedCommands: commandRuns.filter(item => item.status === 'FAIL').map(item => item.command),
  }, null, 2));

  if (report.status === 'FAIL') {
    process.exit(1);
  }
}

main();

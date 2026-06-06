import fs from 'node:fs';

const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exit(1);
};

const pass = (condition, message) => {
  if (!condition) fail(message);
};

const read = (path) => fs.readFileSync(path, 'utf8');

const app = read('src/App.jsx');
const boundary = read('src/components/ErrorBoundary.jsx');
const runtime = read('src/runtime/runtimeCapabilities.js');
const settings = read('src/context/SettingsContext.jsx');
const insight = read('src/pages/InsightPage.jsx');
const news = read('src/context/NewsContext.jsx');

pass(!app.includes('class ErrorBoundary'), 'App.jsx still defines inline ErrorBoundary');
pass(
  app.includes("import ErrorBoundary from './components/ErrorBoundary'") ||
  app.includes('from "./components/ErrorBoundary"'),
  'App.jsx must import shared ErrorBoundary'
);

[
  'path="/"',
  'path="/insight"',
  'path="/markets"',
  'path="/up-ahead"',
  'path="/my-planner"',
  'path="/more"',
  'path="/weather"',
  'path="/tech-social"',
  'path="/newspaper"',
  'path="/settings"',
  'path="/refresh"',
  'path="/following"',
  'path="/following/:topicId"',
].forEach(route => {
  pass(app.includes(route), `App.jsx missing route ${route}`);
});

[
  '<SettingsProvider>',
  '<SegmentProvider>',
  '<WeatherProvider lazy={true}>',
  '<NewsProvider>',
  '<MarketProvider>',
  '<TopicProvider>',
  '<HashRouter>',
].forEach(provider => {
  pass(app.includes(provider), `App.jsx missing provider ${provider}`);
});

pass((app.match(/<ErrorBoundary/g) || []).length >= 13, 'Every route should remain wrapped in ErrorBoundary');
pass(app.includes('label="Main"'), 'Main route missing ErrorBoundary label');
pass(app.includes('label="Insight"'), 'Insight route missing ErrorBoundary label');
pass(app.includes('label="Markets"'), 'Markets route missing ErrorBoundary label');
pass(app.includes('label="Up Ahead"'), 'Up Ahead route missing ErrorBoundary label');
pass(app.includes('label="My Planner"'), 'My Planner route missing ErrorBoundary label');
pass(app.includes('label="More"'), 'More route missing ErrorBoundary label');
pass(app.includes('label="Weather"'), 'Weather route missing ErrorBoundary label');
pass(app.includes('label="Buzz Hub"'), 'TechSocial/Buzz route missing ErrorBoundary label');
pass(app.includes('label="Newspaper"'), 'Newspaper route missing ErrorBoundary label');
pass(app.includes('label="Settings"'), 'Settings route missing ErrorBoundary label');
pass(app.includes('label="Refresh"'), 'Refresh route missing ErrorBoundary label');
pass(app.includes('label="Following"'), 'Following route missing ErrorBoundary label');
pass(app.includes('label="Topic Detail"'), 'TopicDetail route missing ErrorBoundary label');

pass(boundary.includes('componentDidCatch'), 'shared ErrorBoundary must implement componentDidCatch');
pass(boundary.includes('resetKeys'), 'shared ErrorBoundary missing resetKeys support');
pass(boundary.includes('onReset'), 'shared ErrorBoundary missing onReset support');
pass(boundary.includes('role="alert"'), 'shared ErrorBoundary fallback must use role="alert"');
pass(boundary.includes('label'), 'shared ErrorBoundary must support label prop');
pass(boundary.includes('console.error'), 'shared ErrorBoundary must log structured diagnostics');
pass(boundary.includes('componentStack'), 'shared ErrorBoundary must log componentStack');

pass(runtime.includes('STATIC_HOST_PATTERNS'), 'runtimeCapabilities missing STATIC_HOST_PATTERNS');
pass(runtime.includes('github') && runtime.includes('io'), 'runtimeCapabilities missing github.io static host pattern');
pass(runtime.includes('netlify'), 'runtimeCapabilities missing netlify.app static host pattern');
pass(runtime.includes('vercel'), 'runtimeCapabilities missing vercel.app static host pattern');
pass(runtime.includes('pages') && runtime.includes('dev'), 'runtimeCapabilities missing pages.dev static host pattern');
pass(runtime.includes('hostname'), 'runtimeCapabilities must expose hostname');
pass(runtime.includes('VITE_API_BASE_URL'), 'runtimeCapabilities missing env-based API URL detection');
pass(runtime.includes('VITE_BACKEND_URL'), 'runtimeCapabilities missing env-based backend URL detection');
pass(runtime.includes('allowRemoteSettingsSync'), 'runtimeCapabilities missing allowRemoteSettingsSync');
pass(runtime.includes('canUseApi'), 'runtimeCapabilities missing canUseApi');
pass(runtime.includes('canUseRemoteStorage'), 'runtimeCapabilities missing canUseRemoteStorage');
pass(runtime.includes('canUseLocalStorage'), 'runtimeCapabilities missing canUseLocalStorage');

pass(settings.includes('function safeSetLocalStorage'), 'SettingsContext missing safeSetLocalStorage helper');

const setItemMatches = settings.match(/localStorage\.setItem\s*\(/g) || [];
pass(
  setItemMatches.length === 1,
  'SettingsContext should only call localStorage.setItem inside safeSetLocalStorage'
);

pass(
  (settings.match(/safeSetLocalStorage\('dailyEventAI_settings'/g) || []).length >= 2,
  'SettingsContext remote sync writes must use safeSetLocalStorage'
);

pass(insight.includes('getRuntimeCapabilities'), 'InsightPage must use getRuntimeCapabilities');
pass(insight.includes('Pre-generated'), 'InsightPage missing Pre-generated stale label');
pass(insight.includes('formatInsightAge'), 'InsightPage missing formatInsightAge helper');
pass(
  insight.includes('(isStaticHost ? 6 : 3) * 60 * 60 * 1000'),
  'InsightPage missing dynamic 6h/3h cache TTL'
);

pass(news.includes('getRuntimeCapabilities'), 'NewsContext must use getRuntimeCapabilities');
pass(news.includes('15 * 60 * 1000'), 'NewsContext missing static-host 15min refresh interval');
pass(news.includes('5 * 60 * 1000'), 'NewsContext missing non-static 5min refresh interval');
pass(news.includes('refreshIntervalMs'), 'NewsContext missing refreshIntervalMs');

// Protect Release 1A fix.
pass(
  news.includes('Array.isArray(specificSections)'),
  'NewsContext Release 1A guard was lost'
);

console.log('PASS: Release 1C static hardening gates');

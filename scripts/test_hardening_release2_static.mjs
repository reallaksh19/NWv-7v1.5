import fs from 'node:fs';

const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exit(1);
};

const pass = (condition, message) => {
  if (!condition) fail(message);
};

const read = (path) => fs.readFileSync(path, 'utf8');

// ── fetchClient ──────────────────────────────────────────────────────────────
const fetchClient = read('src/data/fetchClient.js');

pass(fetchClient.includes('export function publicDataUrl'), 'fetchClient missing publicDataUrl');
pass(fetchClient.includes('export async function fetchJson'), 'fetchClient missing fetchJson');
pass(fetchClient.includes('AbortController') || fetchClient.includes('signal'), 'fetchClient should support abort signal');
pass(fetchClient.includes('fetch_json_success'), 'fetchClient missing success diagnostic event');
pass(fetchClient.includes('fetch_json_failed'), 'fetchClient missing failure diagnostic event');
pass(fetchClient.includes('makeEnvelope'), 'fetchClient must return canonical envelopes via makeEnvelope');

// ── safeStorage ──────────────────────────────────────────────────────────────
const safeStorage = read('src/data/safeStorage.js');

pass(safeStorage.includes('export function getSafeLocalStorage'), 'safeStorage missing getSafeLocalStorage');
pass(safeStorage.includes('export function safeGetJson'), 'safeStorage missing safeGetJson');
pass(safeStorage.includes('export function safeSetJson'), 'safeStorage missing safeSetJson');
pass(safeStorage.includes('export function safeRemove'), 'safeStorage missing safeRemove');
pass(safeStorage.includes('try {') && safeStorage.includes('catch'), 'safeStorage must wrap operations in try/catch');

// ── diagnosticsStore ─────────────────────────────────────────────────────────
const diagnosticsStore = read('src/data/diagnosticsStore.js');

pass(diagnosticsStore.includes('export function recordDiagnostic'), 'diagnosticsStore missing recordDiagnostic');
pass(diagnosticsStore.includes('export function listDiagnostics'), 'diagnosticsStore missing listDiagnostics');
pass(diagnosticsStore.includes('export function clearDiagnostics'), 'diagnosticsStore missing clearDiagnostics');
pass(diagnosticsStore.includes('export function subscribeDiagnostics'), 'diagnosticsStore missing subscribeDiagnostics');
pass(diagnosticsStore.includes('export function __getMaxDiagnosticsForTest'), 'diagnosticsStore missing __getMaxDiagnosticsForTest');
pass(diagnosticsStore.includes('MAX_DIAGNOSTICS'), 'diagnosticsStore must enforce ring buffer limit');
pass(diagnosticsStore.includes('500'), 'diagnosticsStore ring buffer must be 500');

// ── qualityDashboardDataset ──────────────────────────────────────────────────
const qualityDashboard = read('src/data/datasets/qualityDashboardDataset.js');

pass(qualityDashboard.includes('export async function load'), 'qualityDashboardDataset missing load()');
pass(qualityDashboard.includes('makeEnvelope'), 'qualityDashboardDataset must use makeEnvelope');
pass(qualityDashboard.includes("datasetId: 'qualityDashboard'"), 'qualityDashboardDataset must set datasetId');
pass(qualityDashboard.includes('quality_dashboard_inconsistent'), 'qualityDashboardDataset must detect inconsistency');
pass(qualityDashboard.includes('quality_dashboard.json'), 'qualityDashboardDataset must fetch quality_dashboard');
pass(qualityDashboard.includes('insight_quality_report.json'), 'qualityDashboardDataset must fetch insight quality report');
pass(qualityDashboard.includes('__qualityDashboardInternalsForTest'), 'qualityDashboardDataset must export test internals');

// ── sourceHealthDataset ──────────────────────────────────────────────────────
const sourceHealth = read('src/data/datasets/sourceHealthDataset.js');

pass(sourceHealth.includes('export async function load'), 'sourceHealthDataset missing load()');
pass(sourceHealth.includes('makeEnvelope'), 'sourceHealthDataset must use makeEnvelope');
pass(sourceHealth.includes("datasetId: 'sourceHealth'"), 'sourceHealthDataset must set datasetId');
pass(sourceHealth.includes('SOURCE_HEALTH_CANDIDATES'), 'sourceHealthDataset must try multiple candidate paths');
pass(sourceHealth.includes('source_health_unavailable'), 'sourceHealthDataset must emit unavailable event');
pass(sourceHealth.includes('__sourceHealthInternalsForTest'), 'sourceHealthDataset must export test internals');

// ── marketDataset ────────────────────────────────────────────────────────────
const marketDataset = read('src/data/datasets/marketDataset.js');

pass(marketDataset.includes('export async function load'), 'marketDataset missing load()');
pass(marketDataset.includes('makeEnvelope'), 'marketDataset must use makeEnvelope');
pass(marketDataset.includes("datasetId: 'market'"), 'marketDataset must set datasetId');
pass(marketDataset.includes('fetchAllMarketData'), 'marketDataset must call fetchAllMarketData');
pass(marketDataset.includes('market_indices_empty'), 'marketDataset must emit empty indices error');
pass(!marketDataset.includes('fetchJson('), 'marketDataset must NOT call fetchJson (uses service)');

// ── datasets/index.js ────────────────────────────────────────────────────────
const datasetsIndex = read('src/data/datasets/index.js');

pass(datasetsIndex.includes('export const DATASET_LOADERS'), 'datasets/index missing DATASET_LOADERS');
pass(datasetsIndex.includes('Object.freeze'), 'DATASET_LOADERS must be frozen');
pass(datasetsIndex.includes('market:'), 'DATASET_LOADERS must include market');
pass(datasetsIndex.includes('qualityDashboard:'), 'DATASET_LOADERS must include qualityDashboard');
pass(datasetsIndex.includes('sourceHealth:'), 'DATASET_LOADERS must include sourceHealth');
pass(datasetsIndex.includes('export function getDatasetLoader'), 'datasets/index missing getDatasetLoader');

// ── useDataset ───────────────────────────────────────────────────────────────
const useDataset = read('src/data/orchestrator/useDataset.js');

pass(useDataset.includes('export async function loadDataset'), 'useDataset missing loadDataset');
pass(useDataset.includes('export function useDataset'), 'useDataset missing useDataset hook');
pass(useDataset.includes('export function listDatasetCache'), 'useDataset missing listDatasetCache');
pass(useDataset.includes('envelopeCache'), 'useDataset must have module-level envelope cache');
pass(useDataset.includes('inFlight'), 'useDataset must deduplicate in-flight requests');
pass(useDataset.includes('Unknown dataset'), 'useDataset must throw on unknown dataset id');
pass(useDataset.includes('useMountedRef'), 'useDataset hook must use useMountedRef to guard setState');
pass(useDataset.includes('__clearDatasetCacheForTest'), 'useDataset must export cache-clearing helper for tests');

// ── Cert test files exist ────────────────────────────────────────────────────
const testFiles = [
  'src/data/fetchClient.cert.test.js',
  'src/data/safeStorage.cert.test.js',
  'src/data/diagnosticsStore.cert.test.js',
  'src/data/datasets/qualityDashboardDataset.cert.test.js',
  'src/data/datasets/sourceHealthDataset.cert.test.js',
  'src/data/datasets/marketDataset.cert.test.js',
  'src/data/orchestrator/useDataset.cert.test.js',
];

for (const file of testFiles) {
  pass(fs.existsSync(file), `Missing cert test: ${file}`);
}

// ── No raw fetch() inside tab pages (Rule 2) ──────────────────────────────────
// Release 2 must not have migrated tab pages to use raw fetch
const tabPages = [
  'src/pages/MainPage.jsx',
  'src/pages/InsightPage.jsx',
  'src/pages/WeatherPage.jsx',
];

for (const page of tabPages) {
  if (fs.existsSync(page)) {
    const content = read(page);
    // Only fail if a raw global fetch() is introduced (not via fetchJson import)
    const hasFetchJson = content.includes('fetchJson');
    const hasRawFetch = /\bfetch\s*\(/.test(content) && !hasFetchJson;
    pass(!hasRawFetch, `${page} must not contain raw fetch() — use fetchJson or useDataset`);
  }
}

console.log('PASS: Release 2 static hardening gates');

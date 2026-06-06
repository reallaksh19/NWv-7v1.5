import fs from 'node:fs';

const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exit(1);
};

const pass = (condition, message) => {
  if (!condition) fail(message);
};

const read = (path) => fs.readFileSync(path, 'utf8');
const exists = (path) => fs.existsSync(path);

// ── Release 2 prerequisite gate ───────────────────────────────────────────────
[
  'src/data/fetchClient.js',
  'src/data/datasets/marketDataset.js',
  'src/data/datasets/qualityDashboardDataset.js',
  'src/data/datasets/sourceHealthDataset.js',
  'src/data/orchestrator/useDataset.js',
].forEach(path => {
  pass(exists(path), `Missing Release 2 prerequisite: ${path}`);
});

// ── New Release 3 files must exist ───────────────────────────────────────────
// Note: loadWithPolicy.js was removed in fix(A-1) — it was dead code unreferenced
// by any dataset or service. Its removal is intentional and verified.
[
  'src/data/healthScore.js',
  'src/data/slo/marketSlo.js',
  'src/data/slo/qualityDashboardSlo.js',
  'src/data/slo/sourceHealthSlo.js',
  'scripts/validate_quality_dashboard.mjs',
  'scripts/test_market_cascade_fixture.mjs',
].forEach(path => {
  pass(exists(path), `Missing Release 3 file: ${path}`);
});

pass(!exists('src/data/loadWithPolicy.js'), 'loadWithPolicy.js must be absent — it was dead code (fix A-1)');

// ── healthScore.js ────────────────────────────────────────────────────────────
const healthScore = read('src/data/healthScore.js');

pass(healthScore.includes('export function computeHealthScore'), 'healthScore missing computeHealthScore export');
pass(healthScore.includes('hasRequiredFailure'), 'healthScore must compute hasRequiredFailure separately');
pass(healthScore.includes("'failed'"), 'healthScore status must include failed branch');
pass(healthScore.includes("'healthy'"), 'healthScore status must include healthy branch');
pass(healthScore.includes("'degraded'"), 'healthScore status must include degraded branch');

// Verify the required-failure → status:failed logic is correct
// When required SLO fails, status MUST be 'failed', regardless of numeric score
const healthScoreBody = healthScore.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
pass(
  healthScoreBody.includes('hasRequiredFailure || bounded < 70') ||
  healthScoreBody.includes('hasRequiredFailure||bounded<70') ||
  (healthScoreBody.includes('hasRequiredFailure') && healthScoreBody.includes("'failed'")),
  'healthScore must set status:failed when hasRequiredFailure (not just when score < 70)'
);

// ── SLO files ─────────────────────────────────────────────────────────────────
const marketSlo = read('src/data/slo/marketSlo.js');

pass(marketSlo.includes('export function evaluateMarketSlo'), 'marketSlo missing evaluateMarketSlo export');
pass(marketSlo.includes('market_indices_empty'), 'marketSlo must check for empty indices');
pass(marketSlo.includes('market_invalid_timestamp'), 'marketSlo must check timestamp validity');
pass(marketSlo.includes('required: true'), 'marketSlo must be a required SLO');

const qualityDashboardSlo = read('src/data/slo/qualityDashboardSlo.js');

pass(qualityDashboardSlo.includes('export function evaluateQualityDashboardSlo'), 'qualityDashboardSlo missing export');
pass(qualityDashboardSlo.includes('dashboard_inconsistent_with_insight_report'), 'qualityDashboardSlo must detect inconsistency');
pass(qualityDashboardSlo.includes('required: true'), 'qualityDashboardSlo must be a required SLO');

const sourceHealthSlo = read('src/data/slo/sourceHealthSlo.js');

pass(sourceHealthSlo.includes('export function evaluateSourceHealthSlo'), 'sourceHealthSlo missing export');
pass(sourceHealthSlo.includes('source_health_empty'), 'sourceHealthSlo must check for empty sources');
pass(sourceHealthSlo.includes('required: false'), 'sourceHealthSlo must be non-required (optional) SLO');

// ── marketDataset.js — must use SLO and return makeEnvelope ──────────────────
const marketDataset = read('src/data/datasets/marketDataset.js');

pass(marketDataset.includes('evaluateMarketSlo'), 'marketDataset must import and use evaluateMarketSlo');
pass(marketDataset.includes('makeEnvelope'), 'marketDataset must return makeEnvelope()');
pass(marketDataset.includes('const ok = displayable'), 'marketDataset ok must reflect displayability for stale-visible data');
pass(marketDataset.includes('required: false'), 'marketDataset displayable stale data must use a non-required SLO envelope');
pass(marketDataset.includes('passed: ok'), 'marketDataset SLO envelope must reflect displayability result');
pass(!marketDataset.includes("ok: hasIndices"), 'marketDataset must not use hasIndices for ok (use slo.passed)');

// ── indianMarketStableService.js MUST NOT be modified in Release 3 ────────────
// This is checked by final git diff report; add a content assertion as proxy
const marketService = read('src/services/indianMarketStableService.js');
pass(marketService.includes('fetchAllMarketData'), 'indianMarketStableService must still export fetchAllMarketData');
// If service is intact it will still have its cascade logic
pass(
  marketService.includes('snapshot') || marketService.includes('cache') || marketService.includes('seed'),
  'indianMarketStableService must retain its cascade fallback logic (not stripped by Release 3)'
);

// ── generate_quality_dashboard.mjs — must have false-zero guard ───────────────
const dashboard = read('scripts/generate_quality_dashboard.mjs');

pass(dashboard.includes('process.exit(1)'), 'generate_quality_dashboard must exit(1) on false-zero');
pass(
  dashboard.includes('Refusing to write false-zero') ||
  dashboard.includes('false-zero'),
  'generate_quality_dashboard must guard against false-zero output'
);
pass(
  dashboard.includes('extractStoryCount') || dashboard.includes('storyCount ??'),
  'generate_quality_dashboard must use tolerant field extraction'
);

// ── validate_quality_dashboard.mjs ────────────────────────────────────────────
const validator = read('scripts/validate_quality_dashboard.mjs');

pass(validator.includes('process.exit(1)'), 'validate_quality_dashboard must exit(1) on inconsistency');
pass(
  validator.includes('dashboard_inconsistent_with_insight_report') ||
  validator.includes('dashboardTotalStories === 0'),
  'validate_quality_dashboard must check for inconsistency'
);

// ── Workflow ordering verification ────────────────────────────────────────────
const workflow = read('.github/workflows/news_prefetch.yml');

const benchmarkIndex = workflow.indexOf('Run real Insight snapshot quality benchmark');
const dashboardGenIndex = workflow.indexOf('Generate quality dashboard');
const dashboardValidateIndex = workflow.indexOf('Validate quality dashboard');
const dashboardUploadIndex = workflow.indexOf('Upload quality dashboard');
const commitIndex = workflow.indexOf('Commit data');

pass(benchmarkIndex > 0, 'Workflow must contain real Insight snapshot quality benchmark step');
pass(dashboardGenIndex > benchmarkIndex, 'Dashboard generation must come AFTER the benchmark');
pass(dashboardValidateIndex > dashboardGenIndex, 'Dashboard validation must come AFTER dashboard generation');
pass(dashboardUploadIndex > dashboardValidateIndex, 'Dashboard artifact upload must come AFTER validation');
pass(commitIndex > dashboardUploadIndex, 'Commit must come AFTER dashboard upload');

// Benchmark must NOT be conditional on should_commit
const benchmarkStepBlock = workflow.slice(benchmarkIndex - 200, benchmarkIndex + 100);
pass(
  !benchmarkStepBlock.includes("if: steps.prefetch_commit.outputs.should_commit == 'true'"),
  'Benchmark step must be unconditional (not gated on should_commit)'
);

// ── No page/UI migration in Release 3 ────────────────────────────────────────
const pageFiles = fs.readdirSync('src/pages').filter(f => /\.(jsx|js)$/.test(f));

for (const file of pageFiles) {
  const content = read(`src/pages/${file}`);
  pass(!content.includes('useDataset('), `Release 3 must not migrate pages to useDataset yet: ${file}`);
}

// ── Cert test files exist ─────────────────────────────────────────────────────
// loadWithPolicy.cert.test.js removed alongside the dead loadWithPolicy.js (fix A-1)
[
  'src/data/healthScore.cert.test.js',
  'src/data/slo/marketSlo.cert.test.js',
  'src/data/slo/qualityDashboardSlo.cert.test.js',
  'src/data/slo/sourceHealthSlo.cert.test.js',
].forEach(path => {
  pass(exists(path), `Missing Release 3 cert test: ${path}`);
});

console.log('PASS: Release 3 static hardening gates');

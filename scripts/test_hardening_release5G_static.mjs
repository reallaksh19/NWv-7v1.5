import fs from 'node:fs';

const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exit(1);
};

const pass = (condition, message) => {
  if (!condition) fail(message);
};

const exists = path => fs.existsSync(path);
const read = path => fs.readFileSync(path, 'utf8');

[
  'src/data/slo/applyDatasetSlo.js',
  'src/components/DataStateBoundary.jsx',
  'src/components/data-state/index.js',
  'src/data/datasets/index.js',
  'src/data/datasets/insightDataset.js',
  'scripts/test_hardening_release5FC_static.mjs',
].forEach(path => {
  pass(exists(path), `Missing Release 5F-C/5C prerequisite: ${path}`);
});

[
  'src/viewModels/useInsightTabViewModel.js',
  'src/pages/InsightPage.jsx',
  'src/viewModels/useInsightTabViewModel.cert.test.js',
  'src/pages/InsightPage.release5G.cert.test.jsx',
].forEach(path => {
  pass(exists(path), `Missing Release 5G file: ${path}`);
});

const registry = read('src/data/datasets/index.js');
const insightDataset = read('src/data/datasets/insightDataset.js');
const vm = read('src/viewModels/useInsightTabViewModel.js');
const page = read('src/pages/InsightPage.jsx');
const followingPage = read('src/pages/FollowingPage.jsx');

pass(followingPage.includes('useFollowingTabViewModel'), 'Release 5F-C prerequisite missing: FollowingPage not migrated');
pass(followingPage.includes('DataStateBoundary'), 'Release 5F-C prerequisite missing: FollowingPage missing DataStateBoundary');

pass(registry.includes('insight'), 'DATASET_LOADERS must register insight');
pass(insightDataset.includes('applyDatasetSlo'), 'insightDataset must be SLO-wrapped from Release 5C');
pass(
  insightDataset.includes("datasetId: 'insight'") || insightDataset.includes('datasetId: "insight"'),
  'insightDataset must emit datasetId insight'
);

pass(vm.includes("useDataset('insight')"), 'Insight ViewModel must use insight dataset');
pass(vm.includes('runInsightPipeline'), 'Insight ViewModel must own pipeline fallback');
pass(vm.includes('createInsightFetcher'), 'Insight ViewModel must own fetcher creation');
pass(vm.includes('recoverInsightRuntimeQuality'), 'Insight ViewModel must own runtime quality recovery');
pass(vm.includes('repairInsightResult'), 'Insight ViewModel must own result repair');
pass(vm.includes('readInsightCache'), 'Insight ViewModel must own cache read');
pass(vm.includes('writeInsightCache'), 'Insight ViewModel must own cache write');
pass(vm.includes('pendingResult'), 'Insight ViewModel must own pending result workflow');
pass(vm.includes('setInterval'), 'Insight ViewModel must own background interval refresh');
pass(vm.includes('visibilitychange'), 'Insight ViewModel must own visibility refresh');
pass(vm.includes('useMountedRef'), 'Insight ViewModel must guard mounted async state');
pass(vm.includes("typeof document === 'undefined'"), 'Insight ViewModel must guard document access');
pass(vm.includes("typeof window === 'undefined'"), 'Insight ViewModel must guard localStorage/window access');

pass(vm.includes('bootstrapStartedRef'), 'Insight ViewModel must not start pipeline before dataset load is settled');
pass(vm.includes('hasRenderableInsightResult'), 'Insight ViewModel must not treat zero-parent result as renderable');
pass(vm.includes('hasQualityAcceptedInsightResult'), 'Insight ViewModel must distinguish renderable from quality-accepted results');
pass(vm.includes('hasCacheAcceptableInsightResult'), 'Insight cache must require quality-accepted results');
pass(vm.includes('getInsightResultSignature'), 'Insight ViewModel must compare meaningful result signatures');
pass(vm.includes('hasMeaningfulInsightChange'), 'Insight ViewModel must not compare only parent count');
pass(vm.includes('renderableDatasetResult'), 'Insight ViewModel must use renderable dataset result guard');
pass(vm.includes('getRefreshOutcome'), 'Insight ViewModel must handle degraded dataset/fallback refresh outcomes');
pass(vm.includes('forcePipeline'), 'Insight ViewModel must support explicit pipeline refresh option');
pass(vm.includes('Pre-generated ·'), 'Insight ViewModel must preserve pre-generated snapshot label');
pass(vm.includes('insight_no_renderable_clusters'), 'Insight boundary envelope must mark zero-parent output as invalid');
pass(vm.includes('insight.view_model.projected_result'), 'Insight ViewModel boundary envelope must add projection diagnostics');

pass(page.includes('useInsightTabViewModel'), 'InsightPage must use Insight ViewModel');
pass(page.includes('DataStateBoundary'), 'InsightPage must use DataStateBoundary');
pass(page.includes('InsightTab'), 'InsightPage must preserve InsightTab');
pass(page.includes('InsightDiagnosticsPanel'), 'InsightPage must preserve Insight diagnostics component');
pass(page.includes('InsightRankingDiagnosticsPanel'), 'InsightPage must preserve ranking diagnostics');
pass(page.includes('InsightBehaviorEvidencePanel'), 'InsightPage must preserve behavior evidence');
pass(page.includes('FreshBanner'), 'InsightPage must preserve fresh-result banner');

[
  'runInsightPipeline',
  'createInsightFetcher',
  'recoverInsightRuntimeQuality',
  'repairInsightResult',
  'INSIGHT_OUTPUT_CONTRACT_VERSION',
  'CACHE_KEY',
  'readCache',
  'writeCache',
  'REFRESH_EVERY',
  'HIDDEN_REFRESH',
  'visibilitychange',
  'setInterval',
].forEach(token => {
  pass(!page.includes(token), `InsightPage must not contain data orchestration token ${token}`);
});

[
  'ANGLE_DISPLAY_LABELS',
  'SNAPSHOT_DISPLAY_LABELS',
  'getInsightAuditRows',
  'getInsightAuditSummary',
  'getInsightRankingDiagnosticRows',
  'getInsightRankingDiagnosticSummary',
  'InsightDiagnosticsPanel',
  'InsightRankingDiagnosticsPanel',
  'InsightBehaviorEvidencePanel',
  'NewsdataRuntimeStatusPanel',
  'GradeBadge',
  'FreshBanner',
].forEach(token => {
  pass(page.includes(token), `InsightPage must preserve Insight concept token: ${token}`);
});

pass(page.includes('function InsightQualityPopupButton'), 'Insight quality popup component missing');
pass(page.includes('data-insight-quality-popup="ranking-icon"'), 'Insight quality diagnostics must move to ranking icon popup');
pass(page.includes('aria-label="Open Insight quality diagnostics"'), 'Insight quality popup trigger missing accessibility label');
pass(page.includes('insight-quality-inline'), 'InsightPage must keep compact quality signal visible after moving diagnostics to popup');
pass(page.includes('Signal <b>{diagnostics.signalScore}</b>'), 'InsightPage compact quality signal must include signal score');
pass(page.includes('getStoryPublishedAtMs'), 'InsightPage must parse numeric and ISO timestamps robustly');
pass(!page.includes('<InsightDiagnosticsPanel diagnostics={diagnostics} />\n      <InsightAuditPanel'), 'Insight quality diagnostics still rendered as center banner before audit panel');
pass(!page.includes('treatEmptyAsReady={true}'), 'InsightPage must not treat empty Insight result as ready');

// Note: Main tab view model was added in release 5G/later (expected, already present)

const pkg = JSON.parse(read('package.json'));

pass(
  pkg.scripts?.['test:hardening:release5G'] === 'node scripts/test_hardening_release5G_static.mjs',
  'package.json missing test:hardening:release5G script'
);

pass(
  typeof pkg.scripts?.['test:insight-migration'] === 'string',
  'package.json missing test:insight-migration script'
);

[
  'useInsightTabViewModel.cert.test.js',
  'InsightPage.release5G.cert.test.jsx',
].forEach(testFile => {
  pass(
    pkg.scripts['test:insight-migration'].includes(testFile),
    `package.json test:insight-migration missing ${testFile}`
  );
});

[
  'date-fns',
  'lodash',
  'zod',
].forEach(dep => {
  pass(!pkg.dependencies?.[dep], `Release 5G must not add dependency ${dep}`);
  pass(!pkg.devDependencies?.[dep], `Release 5G must not add devDependency ${dep}`);
});

const workflowDir = '.github/workflows';

if (exists(workflowDir)) {
  const workflowFiles = fs.readdirSync(workflowDir)
    .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'));

  for (const file of workflowFiles) {
    const content = read(`${workflowDir}/${file}`);
    pass(!content.includes('release5G'), `Release 5G must not modify workflows: ${file}`);
  }
}

console.log('PASS: Release 5G corrected Insight migration gates');

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
  'src/data/datasets/plannerDataset.js',
  'scripts/test_hardening_release5FA_static.mjs',
].forEach(path => {
  pass(exists(path), `Missing Release 5F-A/5C prerequisite: ${path}`);
});

[
  'src/viewModels/usePlannerTabViewModel.js',
  'src/pages/MyPlannerPage.jsx',
  'src/viewModels/usePlannerTabViewModel.cert.test.js',
  'src/pages/MyPlannerPage.release5FB.cert.test.jsx',
].forEach(path => {
  pass(exists(path), `Missing Release 5F-B file: ${path}`);
});

const registry = read('src/data/datasets/index.js');
const plannerDataset = read('src/data/datasets/plannerDataset.js');
const vm = read('src/viewModels/usePlannerTabViewModel.js');
const page = read('src/pages/MyPlannerPage.jsx');
const newspaperPage = read('src/pages/NewspaperPage.jsx');

pass(newspaperPage.includes('useNewspaperTabViewModel'), 'Release 5F-A prerequisite missing: NewspaperPage not migrated');
pass(newspaperPage.includes('DataStateBoundary'), 'Release 5F-A prerequisite missing: NewspaperPage missing DataStateBoundary');

pass(registry.includes('planner'), 'DATASET_LOADERS must register planner');
pass(plannerDataset.includes('applyDatasetSlo'), 'plannerDataset must be SLO-wrapped from Release 5C');
pass(
  plannerDataset.includes("datasetId: 'planner'") || plannerDataset.includes('datasetId: "planner"'),
  'plannerDataset must emit datasetId planner'
);

pass(vm.includes("useDataset('planner')"), 'Planner ViewModel must use planner dataset');
pass(vm.includes('plannerStorage'), 'Planner ViewModel must own plannerStorage access');
pass(vm.includes('getPlannerEvidence'), 'Planner ViewModel must own planner evidence');
pass(vm.includes('getPlannerViewModel'), 'Planner ViewModel must own planner projection');
pass(vm.includes('getPlannerBulkActionSummary'), 'Planner ViewModel must own bulk summary');
pass(vm.includes('getPlannerItemInspector'), 'Planner ViewModel must own inspector model');
pass(vm.includes('getPlannerAgendaExport'), 'Planner ViewModel must own agenda export model');
pass(vm.includes('getPlannerInteractionQuality'), 'Planner ViewModel must own interaction quality');
pass(vm.includes('getPlannerStateHygiene'), 'Planner ViewModel must own state hygiene');
pass(vm.includes('reconcilePlannerSelection'), 'Planner ViewModel must own selection reconciliation');
pass(vm.includes('useMountedRef'), 'Planner ViewModel must guard mounted async state');
pass(vm.includes('clearTimeout'), 'Planner ViewModel must clear timers');

pass(vm.includes('safeConfirm'), 'Planner ViewModel must guard confirm()');
pass(vm.includes('safePrint'), 'Planner ViewModel must guard window.print()');
pass(vm.includes('typeof navigator !=='), 'Planner ViewModel must guard navigator access');
pass(vm.includes('typeof document ==='), 'Planner ViewModel must guard document fallback access');
pass(vm.includes('const removed = plannerStorage.removeItem'), 'Planner ViewModel must check removeItem return value');
pass(vm.includes('const restored = plannerStorage.addItem'), 'Planner ViewModel must check addItem return value');
pass(vm.includes('Planner item was not removed'), 'Planner ViewModel must report failed single remove');
pass(vm.includes('Planner item was not restored'), 'Planner ViewModel must report failed undo restore');
pass(vm.includes('getPlannerStorageItemId(item.raw || item)'), 'Bulk removal must use canonical planner storage id');

pass(page.includes('usePlannerTabViewModel'), 'MyPlannerPage must use Planner ViewModel');
pass(page.includes('DataStateBoundary'), 'MyPlannerPage must use DataStateBoundary');
pass(page.includes('treatEmptyAsReady={true}'), 'MyPlannerPage must treat empty planner as valid ready UI');

[
  "from '../utils/plannerStorage'",
  'plannerStorage',
  'getPlannerEvidence',
  'getPlannerViewModel',
  'getPlannerBulkActionSummary',
  'makePlannerSelectionKey',
  'getPlannerItemInspector',
  'getPlannerAgendaExport',
  'getPlannerInteractionQuality',
  'getPlannerStateHygiene',
  'reconcilePlannerSelection',
  'downloadCalendarEvent',
  'downloadCalendarEvents',
].forEach(token => {
  pass(!page.includes(token), `MyPlannerPage must not contain ${token}`);
});

[
  'function PlannerControlsPanel',
  'function PlannerBulkActionBar',
  'function PlannerAgendaExportPanel',
  'function PlannerItemInspectorPanel',
].forEach(token => {
  pass(page.includes(token), `MyPlannerPage must preserve panel function: ${token}`);
});

[
  'PlannerControlsPanel',
  'PlannerBulkActionBar',
  'PlannerStateHygienePanel',
  'PlannerInteractionQualityPanel',
  'PlannerAgendaExportPanel',
  'PlannerItemInspectorPanel',
  'PlannerEvidencePanel',
  'SwipeableItem',
].forEach(token => {
  pass(page.includes(token), `MyPlannerPage lost UI token: ${token}`);
});

const pkg = JSON.parse(read('package.json'));

pass(
  pkg.scripts?.['test:hardening:release5FB'] === 'node scripts/test_hardening_release5FB_static.mjs',
  'package.json missing test:hardening:release5FB script'
);

pass(
  typeof pkg.scripts?.['test:planner-migration'] === 'string',
  'package.json missing test:planner-migration script'
);

[
  'usePlannerTabViewModel.cert.test.js',
  'MyPlannerPage.release5FB.cert.test.jsx',
].forEach(testFile => {
  pass(
    pkg.scripts['test:planner-migration'].includes(testFile),
    `package.json test:planner-migration missing ${testFile}`
  );
});

[
  'date-fns',
  'lodash',
  'zod',
].forEach(dep => {
  pass(!pkg.dependencies?.[dep], `Release 5F-B must not add dependency ${dep}`);
  pass(!pkg.devDependencies?.[dep], `Release 5F-B must not add devDependency ${dep}`);
});

const workflowDir = '.github/workflows';

if (exists(workflowDir)) {
  const workflowFiles = fs.readdirSync(workflowDir)
    .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'));

  for (const file of workflowFiles) {
    const content = read(`${workflowDir}/${file}`);
    pass(!content.includes('release5FB'), `Release 5F-B must not modify workflows: ${file}`);
  }
}

console.log('PASS: Release 5F-B corrected Planner migration gates');

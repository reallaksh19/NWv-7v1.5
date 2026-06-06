import fs from 'node:fs';

const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exit(1);
};

const pass = (condition, message) => {
  if (!condition) fail(message);
};

const read = path => fs.readFileSync(path, 'utf8');

function exists(path) {
  return fs.existsSync(path);
}

function hasImportFrom(content, sourcePath) {
  const escaped = sourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`from\\s+['"]${escaped}['"]`).test(content);
}

const requiredFiles = [
  'src/viewModels/useMyPlannerPageViewModel.js',
  'src/pages/MyPlannerPage.jsx',
  'src/pages/MyPlannerPage.release6S.cert.test.jsx',
  'scripts/test_hardening_release6S_static.mjs',
];

requiredFiles.forEach(path => {
  pass(exists(path), `Required Release 6S file missing: ${path}`);
});

const page = read('src/pages/MyPlannerPage.jsx');
const vm = read('src/viewModels/useMyPlannerPageViewModel.js');
const pkg = JSON.parse(read('package.json'));

[
  '../utils/plannerStorage',
  '../services/plannerEvidence',
  '../services/plannerViewModel',
  '../services/plannerBulkActions',
  '../services/plannerItemInspector',
  '../services/plannerAgendaExport',
  '../services/plannerInteractionQuality',
  '../services/plannerStateHygiene',
].forEach(source => {
  pass(!hasImportFrom(page, source), `MyPlannerPage must not import ${source}`);
});

pass(!page.includes('plannerStorage.'), 'MyPlannerPage must not call plannerStorage directly');
pass(!page.includes('getPlannerEvidence('), 'MyPlannerPage must not call getPlannerEvidence directly');
pass(!page.includes('getPlannerViewModel('), 'MyPlannerPage must not call getPlannerViewModel directly');
pass(!page.includes('getPlannerBulkActionSummary('), 'MyPlannerPage must not call bulk summary directly');
pass(!page.includes('makePlannerSelectionKey('), 'MyPlannerPage must not call makePlannerSelectionKey directly');
pass(!page.includes('getPlannerItemInspector('), 'MyPlannerPage must not call item inspector directly');
pass(!page.includes('getPlannerAgendaExport('), 'MyPlannerPage must not call agenda export directly');
pass(!page.includes('reconcilePlannerSelection('), 'MyPlannerPage must not reconcile selection directly');
pass(page.includes('useMyPlannerPageViewModel'), 'MyPlannerPage must use MyPlanner ViewModel');

[
  "from '../utils/plannerStorage'",
  "from '../utils/calendar'",
  "from '../services/plannerEvidence'",
  "from '../services/plannerViewModel'",
  "from '../services/plannerBulkActions'",
  "from '../services/plannerItemInspector'",
  "from '../services/plannerAgendaExport'",
  "from '../services/plannerInteractionQuality'",
  "from '../services/plannerStateHygiene'",
  'plannerStorage.getPlan',
  'plannerStorage.removeItem',
  'plannerStorage.addItem',
  'downloadCalendarEvent',
  'downloadCalendarEvents',
  'getPlannerEvidence',
  'getPlannerViewModel',
  'getPlannerBulkActionSummary',
  'makePlannerSelectionKey',
  'getPlannerItemInspector',
  'getPlannerAgendaExport',
  'buildPlannerAgendaText',
  'buildPlannerAgendaJson',
  'downloadPlannerAgendaFile',
  'getPlannerInteractionQuality',
  'getPlannerStateHygiene',
  'reconcilePlannerSelection',
  'buildPlannerGroups',
].forEach(token => {
  pass(vm.includes(token), `MyPlanner ViewModel missing token: ${token}`);
});

pass(page.includes('PlannerControlsPanel'), 'MyPlannerPage must preserve controls panel');
pass(page.includes('PlannerBulkActionBar'), 'MyPlannerPage must preserve bulk action bar');
pass(page.includes('PlannerItemInspectorPanel'), 'MyPlannerPage must preserve inspector panel');
pass(page.includes('PlannerEvidencePanel'), 'MyPlannerPage must preserve evidence panel');
pass(page.includes('PlannerAgendaExportPanel'), 'MyPlannerPage must preserve agenda export panel');
pass(page.includes('PlannerInteractionQualityPanel'), 'MyPlannerPage must preserve interaction quality panel');
pass(page.includes('PlannerStateHygienePanel'), 'MyPlannerPage must preserve state hygiene panel');
pass(page.includes('SwipeableItem'), 'MyPlannerPage must preserve swipeable item UI');
pass(page.includes('plannerSelectionKey'), 'MyPlannerPage must use projected plannerSelectionKey from ViewModel');
pass(page.includes('plannerSelected'), 'MyPlannerPage must use projected plannerSelected from ViewModel');

['date-fns', 'lodash', 'zod'].forEach(dep => {
  pass(!pkg.dependencies?.[dep], `Release 6S must not add dependency ${dep}`);
  pass(!pkg.devDependencies?.[dep], `Release 6S must not add devDependency ${dep}`);
});

pass(pkg.scripts?.['test:hardening:release6S'], 'package.json missing test:hardening:release6S script');
pass(pkg.scripts?.['test:myplanner-binding'], 'package.json missing test:myplanner-binding script');

console.log('PASS: Release 6S MyPlannerPage ViewModel binding static gates');

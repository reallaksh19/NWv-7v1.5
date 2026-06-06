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

function hasHookCall(content, name) {
  return new RegExp(`\\b${name}\\s*\\(`).test(content);
}

const requiredFiles = [
  'src/viewModels/useUpAheadPageViewModel.js',
  'src/pages/UpAheadPage.jsx',
  'src/pages/UpAheadPage.release6R.cert.test.jsx',
  'scripts/test_hardening_release6R_static.mjs',
];

requiredFiles.forEach(path => {
  pass(exists(path), `Required Release 6R file missing: ${path}`);
});

const page = read('src/pages/UpAheadPage.jsx');
const vm = read('src/viewModels/useUpAheadPageViewModel.js');
const pkg = JSON.parse(read('package.json'));

pass(!hasImportFrom(page, '../context/SettingsContext'), 'UpAheadPage must not import SettingsContext');
pass(!hasImportFrom(page, '../services/upAheadService'), 'UpAheadPage must not import upAheadService');
pass(!hasImportFrom(page, '../utils/plannerStorage'), 'UpAheadPage must not import plannerStorage');
pass(!hasImportFrom(page, '../runtime/runtimeCapabilities'), 'UpAheadPage must not import runtimeCapabilities');
pass(!hasImportFrom(page, '../services/upAheadEvidence'), 'UpAheadPage must not import upAheadEvidence');
pass(!hasImportFrom(page, '../services/upAheadBriefing'), 'UpAheadPage must not import upAheadBriefing');
pass(!hasHookCall(page, 'useSettings'), 'UpAheadPage must not call useSettings()');
pass(page.includes('useUpAheadPageViewModel'), 'UpAheadPage must use Up Ahead ViewModel');

[
  "from '../context/SettingsContext'",
  "from '../services/upAheadService'",
  "from '../utils/plannerStorage'",
  "from '../runtime/runtimeCapabilities'",
  "from '../services/upAheadEvidence'",
  "from '../services/upAheadBriefing'",
  'fetchStaticUpAheadData',
  'fetchLiveUpAheadData',
  'mergeUpAheadData',
  'loadFromCache',
  'saveToCache',
  'clearUpAheadCache',
  'isActualWeatherAlertText',
  'isActualOfferText',
  'getUpAheadEvidence',
  'getUpAheadBriefing',
  'plannerStorage.addItem',
  'plannerStorage.addToBlacklist',
  'getRuntimeCapabilities',
  'getVisibleUpAheadProjection',
  'getSourceModeState',
].forEach(token => {
  pass(vm.includes(token), `Up Ahead ViewModel missing token: ${token}`);
});

pass(page.includes('<UpAheadEvidencePanel evidence={upAheadEvidence} />'), 'UpAheadPage must preserve evidence panel');
pass(page.includes('<UpAheadBriefingPanel briefing={upAheadBriefing} />'), 'UpAheadPage must preserve briefing panel');
pass(page.includes('<DataStatePill mode={modeStr} label={modeLabel} />'), 'UpAheadPage must preserve data-state pill');
pass(page.includes('TimelineCard'), 'UpAheadPage must preserve timeline card rendering');
pass(page.includes('EntertainmentStyleGrid'), 'UpAheadPage must preserve entertainment grid rendering');

['date-fns', 'lodash', 'zod'].forEach(dep => {
  pass(!pkg.dependencies?.[dep], `Release 6R must not add dependency ${dep}`);
  pass(!pkg.devDependencies?.[dep], `Release 6R must not add devDependency ${dep}`);
});

pass(pkg.scripts?.['test:hardening:release6R'], 'package.json missing test:hardening:release6R script');
pass(pkg.scripts?.['test:upahead-binding'], 'package.json missing test:upahead-binding script');

console.log('PASS: Release 6R UpAheadPage ViewModel binding static gates');

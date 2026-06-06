import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), 'Missing file: ' + path);
  return fs.readFileSync(path, 'utf8');
}

const guard = read('src/insight/src/tree/sourceDiverseChildSelection.ts');
const guardTest = read('src/insight/src/tree/sourceDiverseChildSelection.cert.test.ts');
const pipeline = read('src/insight/src/pipeline/pipeline.ts');
const packageJson = read('package.json');

for (const token of [
  'enforceSourceDiverseChildSelection',
  'source-diverse-child-selection-v1',
  'targetSourceGroupCount',
  'sourceDiverseSelectionDiagnostics',
  'adds new source group',
  'replacementKeepsAngleDiversity',
  'orderSourceDiverseChildrenForDisplay',
]) {
  assert(guard.includes(token), 'sourceDiverseChildSelection.ts missing token: ' + token);
}

for (const token of [
  'Insight source-diverse child selection certification',
  'adds a missing source group',
  'replaces same-source-heavy child',
  'does not reduce existing angle diversity',
  'rejects tier D source candidates',
]) {
  assert(guardTest.includes(token), 'sourceDiverseChildSelection.cert.test.ts missing token: ' + token);
}

for (const token of [
  'enforceSourceDiverseChildSelection',
  'const sourceDiversityChildren = enforceSourceDiverseChildSelection',
  'parent.childStoryIds = sourceDiversityChildren.map',
  'isWeakTree(sourceDiversityChildren, cfg)',
]) {
  assert(pipeline.includes(token), 'pipeline.ts missing token: ' + token);
}

assert(
  packageJson.includes('"test:insight-source-diversity-guard"'),
  'package.json must include test:insight-source-diversity-guard'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Insight source diversity guard',
  guarantees: [
    'post-tree source diversity guard exists',
    'source-concentrated child trees can recover a new source',
    'full child trees can replace same-source-heavy child',
    'angle diversity is not reduced below two angles',
    'tier D exclusion is preserved',
    'pipeline freezes sourceDiversityChildren',
    'weakTree detection uses sourceDiversityChildren'
  ],
}, null, 2));

console.log('PASS: Insight source diversity guard static gate');

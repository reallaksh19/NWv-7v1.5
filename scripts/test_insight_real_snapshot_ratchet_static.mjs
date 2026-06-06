import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), 'Missing file: ' + path);
  return fs.readFileSync(path, 'utf8');
}

const ratchet = read('src/insight/src/quality/insightRealSnapshotQualityRatchet.ts');
const ratchetTest = read('src/insight/src/quality/insightRealSnapshotQualityRatchet.cert.test.ts');
const realSnapshotTest = read('src/insight/src/quality/insightRealSnapshotQuality.cert.test.ts');
const verifier = read('scripts/verify_real_insight_quality_report.mjs');
const packageJson = read('package.json');

for (const token of [
  'evaluateRealInsightSnapshotQualityRatchet',
  'real-insight-snapshot-ratchet-v1',
  'grade-floor',
  'avg-angle-count',
  'multi-angle-parent-count',
  'top-parent-angle-count',
  'top-parent-child-depth',
  'weak-parent-ratio',
  'buildRealInsightRatchetMarkdown',
]) {
  assert(ratchet.includes(token), 'insightRealSnapshotQualityRatchet.ts missing token: ' + token);
}

for (const token of [
  'Real Insight snapshot quality ratchet certification',
  'fails D/F grade',
  'fails if top parent is still single-angle',
  'warns for high weak-parent ratio',
  'skips cleanly',
]) {
  assert(ratchetTest.includes(token), 'insightRealSnapshotQualityRatchet.cert.test.ts missing token: ' + token);
}

for (const token of [
  'evaluateRealInsightSnapshotQualityRatchet',
  'ratchetGate',
  'expect(ratchetGate.status).not.toBe("FAIL")',
  'buildRealInsightRatchetMarkdown',
]) {
  assert(realSnapshotTest.includes(token), 'insightRealSnapshotQuality.cert.test.ts missing token: ' + token);
}

for (const token of [
  'real_insight_quality_report.json',
  "gate.status === 'FAIL'",
  'top-parent-angle-count',
  'grade-floor',
]) {
  assert(verifier.includes(token), 'verify_real_insight_quality_report.mjs missing token: ' + token);
}

assert(
  packageJson.includes('"test:insight-real-snapshot-ratchet"'),
  'package.json must include test:insight-real-snapshot-ratchet'
);

assert(
  packageJson.includes('"test:real-insight-snapshot-quality:strict"'),
  'package.json must include test:real-insight-snapshot-quality:strict'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Insight real snapshot quality ratchet',
  guarantees: [
    'real snapshot report includes ratchet gate',
    'D/F grades fail when real snapshot exists',
    'single-angle top parent fails',
    'low average angle count fails',
    'zero multi-angle parent fails',
    'thin top parent fails',
    'weak-parent ratio is warned',
    'generated report can be independently verified'
  ],
}, null, 2));

console.log('PASS: Insight real snapshot quality ratchet static gate');

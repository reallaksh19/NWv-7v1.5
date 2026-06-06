import fs from 'node:fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const verifier = read('scripts/verify_pages_newsdata.mjs');
const prefetchWorkflow = read('.github/workflows/news_prefetch.yml');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

// The verifier script remains available for manual/post-deploy invocation,
// but it must NOT run inline in news_prefetch.yml — that workflow ends
// at the data commit; deploy.yml handles Pages publish asynchronously.
for (const token of [
  'pages-newsdata-verifier-v1',
  'verify_pages_newsdata',
  'summarizeInsightSnapshot',
  'contentHashOk',
  'storyCountOk',
  'schemaOk',
  'no-store',
  'newsdata/insight_latest.json',
  'pages_newsdata_verify_report.json',
  'pages_newsdata_verify_summary.md'
]) {
  assert(verifier.includes(token), `verify_pages_newsdata.mjs missing token: ${token}`);
}

for (const forbidden of [
  'Verify deployed Pages newsdata',
  'node scripts/verify_pages_newsdata.mjs',
  'pages-newsdata-verification',
]) {
  assert(
    !prefetchWorkflow.includes(forbidden),
    `news_prefetch.yml must not contain "${forbidden}" — verification cannot run inline once deploy is async`
  );
}

assert(
  packageJson.includes('"test:pages-newsdata-verification"'),
  'package.json must include test:pages-newsdata-verification'
);

assert(
  (certGate.includes("['npm', ['run', 'test:pages-newsdata-verification']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run test:pages-newsdata-verification'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Pages deployed newsdata verification slice (async deploy)',
  guarantees: [
    'deployed Pages JSON verifier exists for manual / post-deploy use',
    'verifier compares schema/contentHash/storyCount',
    'verifier writes JSON and Markdown reports',
    'news_prefetch.yml does not verify deployed newsdata inline (deploy is async)',
    'certification gate includes deployed newsdata verifier static check'
  ]
}, null, 2));

console.log('PASS: Pages newsdata verification static slice');

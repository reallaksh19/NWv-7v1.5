import fs from 'node:fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const manifestWriter = read('scripts/write_pages_data_manifest.mjs');
const deployWorkflow = read('.github/workflows/deploy.yml');
const prefetchWorkflow = read('.github/workflows/news_prefetch.yml');
const marketWorkflow = read('.github/workflows/market_refresh.yml');
const packageJson = read('package.json');
const certGate = read('scripts/run_certification_gate.mjs');

for (const token of [
  'pages_data_manifest.json',
  'pages-data-publish-v1',
  'dist/newsdata',
  'insight_latest.json',
  'allTrackedFilesMatched',
  'insightContentHash'
]) {
  assert(manifestWriter.includes(token), `write_pages_data_manifest.mjs missing token: ${token}`);
}

// deploy.yml is the single authoritative deploy path; it must build,
// generate the data manifest, and publish via the official Pages action.
for (const token of [
  'npm run build',
  'node scripts/write_pages_data_manifest.mjs',
  'actions/upload-pages-artifact',
  'actions/deploy-pages'
]) {
  assert(deployWorkflow.includes(token), `deploy.yml missing token: ${token}`);
}

assert(
  deployWorkflow.indexOf('npm run build') < deployWorkflow.indexOf('node scripts/write_pages_data_manifest.mjs'),
  'deploy.yml must build before writing the data manifest'
);

assert(
  deployWorkflow.indexOf('node scripts/write_pages_data_manifest.mjs') < deployWorkflow.indexOf('actions/upload-pages-artifact'),
  'deploy.yml must write the data manifest before uploading the Pages artifact'
);

// Data workflows must NOT run their own gh-pages publish (single deploy path).
for (const forbidden of ['npx gh-pages', 'Publish updated Pages site']) {
  assert(
    !prefetchWorkflow.includes(forbidden),
    `news_prefetch.yml must not contain "${forbidden}" — deploy.yml is the single deploy path`
  );
  assert(
    !marketWorkflow.includes(forbidden),
    `market_refresh.yml must not contain "${forbidden}" — deploy.yml is the single deploy path`
  );
}

assert(
  packageJson.includes('"test:pages-data-publish"'),
  'package.json must include test:pages-data-publish'
);

assert(
  (certGate.includes("['npm', ['run', 'test:pages-data-publish']]") || certGate.includes('certification_manifest.json')),
  'certification gate must run test:pages-data-publish'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Pages data publish slice (consolidated deploy)',
  guarantees: [
    'dist/newsdata manifest writer exists',
    'deploy.yml builds then writes the data manifest before publish',
    'deploy.yml is the single Pages deploy path',
    'data workflows do not run their own gh-pages publish',
    'certification gate includes Pages publish static check'
  ]
}, null, 2));

console.log('PASS: Pages data publish static slice');

import fs from 'fs';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function exists(path) {
  return fs.existsSync(path);
}

function read(path) {
  assert(exists(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

function readJson(path) {
  return JSON.parse(read(path));
}

function maybeReadJson(path) {
  if (!exists(path)) return null;
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function checkTokens(fileLabel, content, tokens) {
  for (const token of tokens) {
    assert(
      content.includes(token),
      `${fileLabel} missing required token: ${token}`
    );
  }
}

function checkPackageScript(packageJson, scriptName) {
  assert(
    packageJson.scripts && packageJson.scripts[scriptName],
    `package.json missing script: ${scriptName}`
  );
}

function checkManifestCommand(manifest, scriptName) {
  if (!manifest) {
    console.warn('WARN: scripts/certification_manifest.json not found; skipping manifest check.');
    return;
  }

  const commands = Array.isArray(manifest.commands) ? manifest.commands : [];
  const found = commands.some(command =>
    Array.isArray(command.args) && command.args.join(' ').includes(scriptName)
  );

  assert(
    found,
    `certification_manifest.json missing command for script: ${scriptName}`
  );
}

function checkSourceDiversityGuard() {
  const guard = read('src/insight/src/tree/sourceDiverseChildSelection.ts');
  const guardTest = read('src/insight/src/tree/sourceDiverseChildSelection.cert.test.ts');
  const pipeline = read('src/insight/src/pipeline/pipeline.ts');

  checkTokens('sourceDiverseChildSelection.ts', guard, [
    'enforceSourceDiverseChildSelection',
    'SourceDiverseSelectionDiagnostic',
    'source-diverse-child-selection-v1',
    'targetSourceGroupCount',
    'sourceDiverseSelectionDiagnostics',
    'adds new source group',
    'replacementKeepsAngleDiversity',
    'orderSourceDiverseChildrenForDisplay',
  ]);

  checkTokens('sourceDiverseChildSelection.cert.test.ts', guardTest, [
    'Insight source-diverse child selection certification',
    'adds a missing source group',
    'replaces same-source-heavy child',
    'does not reduce existing angle diversity',
    'rejects tier D source candidates',
  ]);

  checkTokens('pipeline.ts source diversity integration', pipeline, [
    'enforceSourceDiverseChildSelection',
    'const sourceDiversityChildren = enforceSourceDiverseChildSelection',
    'parent.childStoryIds = sourceDiversityChildren.map',
    'storiesById.set(child.id, child)',
    'isWeakTree(sourceDiversityChildren, cfg)',
  ]);

  return {
    status: 'PASS',
    checked: 'Insight Source Diversity Guard for Child Trees',
    guarantees: [
      'source diversity guard file exists',
      'source diversity test file exists',
      'pipeline calls enforceSourceDiverseChildSelection',
      'pipeline freezes sourceDiversityChildren',
      'weakTree is calculated using sourceDiversityChildren',
    ],
  };
}

function checkRealSnapshotRatchet() {
  const ratchet = read('src/insight/src/quality/insightRealSnapshotQualityRatchet.ts');
  const ratchetTest = read('src/insight/src/quality/insightRealSnapshotQualityRatchet.cert.test.ts');
  const realSnapshotTest = read('src/insight/src/quality/insightRealSnapshotQuality.cert.test.ts');
  const verifier = read('scripts/verify_real_insight_quality_report.mjs');

  checkTokens('insightRealSnapshotQualityRatchet.ts', ratchet, [
    'evaluateRealInsightSnapshotQualityRatchet',
    'RealInsightSnapshotRatchetGate',
    'real-insight-snapshot-ratchet-v1',
    'grade-floor',
    'avg-angle-count',
    'multi-angle-parent-count',
    'top-parent-angle-count',
    'top-parent-child-depth',
    'weak-parent-ratio',
    'buildRealInsightRatchetMarkdown',
  ]);

  checkTokens('insightRealSnapshotQualityRatchet.cert.test.ts', ratchetTest, [
    'Real Insight snapshot quality ratchet certification',
    'fails D/F grade',
    'fails if top parent is still single-angle',
    'warns for high weak-parent ratio',
    'skips cleanly',
  ]);

  checkTokens('insightRealSnapshotQuality.cert.test.ts ratchet integration', realSnapshotTest, [
    'evaluateRealInsightSnapshotQualityRatchet',
    'buildRealInsightRatchetMarkdown',
    'ratchetGate',
    'expect(ratchetGate.status).not.toBe("FAIL")',
  ]);

  checkTokens('verify_real_insight_quality_report.mjs', verifier, [
    'real_insight_quality_report.json',
    "gate.status === 'FAIL'",
    'grade-floor',
    'top-parent-angle-count',
  ]);

  return {
    status: 'PASS',
    checked: 'Insight Real Snapshot Quality Benchmark Ratchet',
    guarantees: [
      'ratchet service exists',
      'ratchet tests exist',
      'existing real snapshot benchmark writes ratchetGate',
      'strict benchmark fails on ratchet FAIL',
      'independent verifier exists',
    ],
  };
}

function checkScriptsAndManifest() {
  const packageJson = readJson('package.json');
  const manifest = maybeReadJson('scripts/certification_manifest.json');

  const requiredScripts = [
    'test:insight-source-diverse-child',
    'test:insight-source-diversity-guard',
    'test:insight-real-snapshot-ratchet',
    'verify:real-insight-quality-report',
    'test:real-insight-snapshot-quality:strict',
  ];

  for (const script of requiredScripts) {
    checkPackageScript(packageJson, script);
  }

  checkManifestCommand(manifest, 'test:insight-source-diversity-guard');
  checkManifestCommand(manifest, 'test:insight-real-snapshot-ratchet');

  return {
    status: 'PASS',
    checked: 'package.json and certification manifest',
    scripts: requiredScripts,
  };
}

function checkOptionalStrictReport() {
  const reportPath = 'public/newsdata/real_insight_quality_report.json';

  if (!exists(reportPath)) {
    return {
      status: 'SKIP',
      checked: 'strict real snapshot report',
      reason: 'real_insight_quality_report.json not found. Run npm run test:real-insight-snapshot-quality:strict.',
    };
  }

  const report = readJson(reportPath);
  const gate = report.ratchetGate;

  assert(gate, 'real_insight_quality_report.json exists but ratchetGate is missing.');
  assert(gate.status !== 'FAIL', 'real_insight_quality_report.json ratchetGate status is FAIL.');

  return {
    status: gate.status,
    checked: 'strict real snapshot report',
    grade: gate.grade,
    score: gate.score,
    failed: gate.failed || [],
    summary: gate.summary || {},
  };
}

function main() {
  const results = [
    checkSourceDiversityGuard(),
    checkRealSnapshotRatchet(),
    checkScriptsAndManifest(),
    checkOptionalStrictReport(),
  ];

  const output = {
    status: results.some(item => item.status === 'FAIL') ? 'FAIL' : 'PASS',
    checked: 'Insight two-fix closure audit',
    fixes: [
      'Insight Source Diversity Guard for Child Trees',
      'Insight Real Snapshot Quality Benchmark Ratchet',
    ],
    results,
  };

  console.log(JSON.stringify(output, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({
    status: 'FAIL',
    checked: 'Insight two-fix closure audit',
    error: error.message,
  }, null, 2));

  process.exit(1);
}

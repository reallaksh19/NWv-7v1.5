import fs from 'node:fs';

const WORKFLOW_PATH = '.github/workflows/news_prefetch.yml';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

function indexOfStep(workflow, stepName) {
  const token = `- name: ${stepName}`;
  return workflow.indexOf(token);
}

function requireStep(workflow, stepName) {
  const index = indexOfStep(workflow, stepName);
  assert(index >= 0, `Missing workflow step: ${stepName}`);
  return index;
}

function requireOrder(workflow, beforeStep, afterStep) {
  const before = requireStep(workflow, beforeStep);
  const after = requireStep(workflow, afterStep);

  assert(
    before < after,
    `Workflow order invalid: "${beforeStep}" must appear before "${afterStep}"`
  );
}

function rejectToken(workflow, token, reason) {
  assert(!workflow.includes(token), reason);
}

function requireToken(workflow, token, reason) {
  assert(workflow.includes(token), reason);
}

function validateNewsPrefetchWorkflow(workflow) {
  requireToken(workflow, 'concurrency:', 'workflow must use concurrency guard');
  requireToken(workflow, 'group: news-prefetch', 'workflow concurrency group must be news-prefetch');
  requireToken(workflow, 'contents: write', 'workflow needs contents: write for data commits');

  rejectToken(
    workflow,
    'Bump fetchedAt sentinel',
    'workflow must not mutate fetchedAt just to force commits'
  );

  rejectToken(
    workflow,
    'git add public/newsdata/\n',
    'workflow must not blindly add all public/newsdata files'
  );

  // The old in-workflow Pages publish/verify path is forbidden — deploy.yml
  // is the single authoritative deploy path.
  for (const forbidden of [
    'npx gh-pages',
    'Publish updated Pages site',
    'Verify deployed Pages newsdata',
    'Build Pages site with latest newsdata',
    'pages-newsdata-verification',
  ]) {
    rejectToken(
      workflow,
      forbidden,
      `news_prefetch.yml must not contain "${forbidden}" — Pages publish is owned by deploy.yml`
    );
  }

  // Required core data-pipeline steps
  requireStep(workflow, 'Fetch Insight stories');
  requireStep(workflow, 'Validate Insight prefetch quality');
  requireStep(workflow, 'Fetch Sections stories');
  requireStep(workflow, 'Validate Sections prefetch quality');
  requireStep(workflow, 'Decide whether news data commit is needed');
  requireStep(workflow, 'Commit data');

  // The benchmark is intentionally unconditional observability; only the data
  // commit is gated on meaningful content changes.
  requireStep(workflow, 'Run real Insight snapshot quality benchmark');

  requireOrder(workflow, 'Fetch Insight stories', 'Validate Insight prefetch quality');
  requireOrder(workflow, 'Fetch Sections stories', 'Validate Sections prefetch quality');
  requireOrder(workflow, 'Validate Insight prefetch quality', 'Decide whether news data commit is needed');
  requireOrder(workflow, 'Validate Sections prefetch quality', 'Decide whether news data commit is needed');
  requireOrder(workflow, 'Decide whether news data commit is needed', 'Commit data');
  requireOrder(workflow, 'Decide whether news data commit is needed', 'Run real Insight snapshot quality benchmark');
  // Benchmark runs before commit so its report can be committed too
  requireOrder(workflow, 'Run real Insight snapshot quality benchmark', 'Commit data');

  for (const step of [
    'Commit data',
  ]) {
    const stepIndex = requireStep(workflow, step);
    const nextStepIndex = workflow.indexOf('\n      - name:', stepIndex + 1);
    const block = nextStepIndex > stepIndex
      ? workflow.slice(stepIndex, nextStepIndex)
      : workflow.slice(stepIndex);

    assert(
      block.includes("if: steps.prefetch_commit.outputs.should_commit == 'true'"),
      `${step} must be conditional on should_commit=true`
    );
  }

  for (const token of [
    'python scripts/validate_insight_prefetch_output.py',
    'python scripts/validate_sections_prefetch_output.py',
    'python scripts/prefetch_commit_decision.py',
    'insight-quality-report',
    'sections-quality-report',
    'prefetch-commit-manifest',
    'real-insight-quality-report',
  ]) {
    requireToken(workflow, token, `workflow missing required command/artifact token: ${token}`);
  }

  requireToken(
    workflow,
    'public/newsdata/insight_latest.json public/newsdata/sections_latest.json public/newsdata/source_health.json public/newsdata/prefetch_commit_manifest.json',
    'commit step must stage only meaningful content files plus commit manifest'
  );

  requireToken(
    workflow,
    'Skip commit for diagnostic-only changes',
    'workflow must explicitly skip commits for diagnostic-only changes'
  );

  return {
    status: 'PASS',
    checked: 'News prefetch workflow orchestration (consolidated deploy)',
    guarantees: [
      'concurrency guard exists',
      'fetchedAt-only sentinel is rejected',
      'blind public/newsdata git add is rejected',
      'Insight quality validation runs after Insight fetch',
      'Sections quality validation runs after Sections fetch',
      'commit decision runs after all quality validators',
      'data commit is gated by should_commit=true',
      'benchmark runs before commit so its report joins the commit',
      'workflow does not publish Pages directly — deploy.yml owns publish',
      'required quality and benchmark artifacts are uploaded',
    ],
  };
}

const workflow = read(WORKFLOW_PATH);
const result = validateNewsPrefetchWorkflow(workflow);

console.log(JSON.stringify(result, null, 2));
console.log('PASS: News prefetch workflow orchestration');

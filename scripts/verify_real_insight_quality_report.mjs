import fs from 'fs';
import path from 'path';

const reportPath = path.resolve('public/newsdata/real_insight_quality_report.json');

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function uniqueVisibleAngles(parent) {
  return Array.from(new Set(
    (Array.isArray(parent?.angles) ? parent.angles : [])
      .map(angle => String(angle || '').trim())
      .filter(angle => angle && angle !== 'unknown' && angle !== 'unknown-angle')
  ));
}

function evaluateFallbackRatchet(report) {
  if (!report || report.status === 'SKIP') {
    return {
      status: 'SKIP',
      gateVersion: 'real-insight-snapshot-ratchet-v1-node-fallback',
      grade: 'SKIP',
      score: 0,
      failed: [],
      summary: {},
    };
  }

  const parents = Array.isArray(report.parents) ? report.parents : [];
  const topParent = parents[0];
  const grade = String(report.grade || 'F').toUpperCase();
  const parentCount = numberValue(report.parentCount, parents.length);
  const avgAngles = numberValue(report.avgAngles);
  const multiAngleCount = numberValue(report.multiAngleCount);
  const weakParentCount = numberValue(report.weakParentCount);
  const topParentAngles = uniqueVisibleAngles(topParent).length;
  const topParentChildren = numberValue(topParent?.childCount);
  const weakParentRatio = parentCount ? weakParentCount / parentCount : 0;

  const failed = [];

  if (!['A', 'B', 'C'].includes(grade)) {
    failed.push({
      id: 'grade-floor',
      label: 'Real snapshot grade floor',
      actual: grade,
      required: 'A/B/C',
      severity: 'fail',
    });
  }

  if (parentCount < 3) {
    failed.push({
      id: 'parent-count',
      label: 'Parent cluster count',
      actual: parentCount,
      required: '>= 3',
      severity: 'fail',
    });
  }

  if (avgAngles < 1.4) {
    failed.push({
      id: 'avg-angle-count',
      label: 'Average visible angle count',
      actual: avgAngles,
      required: '>= 1.4',
      severity: 'fail',
    });
  }

  if (multiAngleCount < 1) {
    failed.push({
      id: 'multi-angle-parent-count',
      label: 'Multi-angle parent count',
      actual: multiAngleCount,
      required: '>= 1',
      severity: 'fail',
    });
  }

  if (topParentAngles < 2) {
    failed.push({
      id: 'top-parent-angle-count',
      label: 'Top parent angle count',
      actual: topParentAngles,
      required: '>= 2',
      severity: 'fail',
    });
  }

  if (topParentChildren < 2) {
    failed.push({
      id: 'top-parent-child-depth',
      label: 'Top parent child depth',
      actual: topParentChildren,
      required: '>= 2',
      severity: 'fail',
    });
  }

  if (weakParentRatio > 0.5) {
    failed.push({
      id: 'weak-parent-ratio',
      label: 'Weak parent ratio',
      actual: weakParentRatio,
      required: '<= 0.5',
      severity: 'warn',
    });
  }

  const failCount = failed.filter(item => item.severity === 'fail').length;
  const warnCount = failed.filter(item => item.severity === 'warn').length;

  return {
    status: failCount > 0 ? 'FAIL' : warnCount > 0 ? 'WARN' : 'PASS',
    gateVersion: 'real-insight-snapshot-ratchet-v1-node-fallback',
    grade,
    score: Math.max(0, 100 - failCount * 24 - warnCount * 10),
    failed,
    summary: {
      parentCount,
      avgAngles,
      multiAngleCount,
      weakParentCount,
      weakParentRatio,
      topParentAngles,
      topParentChildren,
      storyCount: numberValue(report.storyCount),
      sourceGroupCount: numberValue(report.sourceGroupCount),
    },
  };
}

if (!fs.existsSync(reportPath)) {
  console.log(JSON.stringify({
    status: 'SKIP',
    reason: 'public/newsdata/real_insight_quality_report.json not found. Run npm run test:real-insight-snapshot-quality first.',
  }, null, 2));
  process.exit(0);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const gate = report.ratchetGate || evaluateFallbackRatchet(report);

console.log(JSON.stringify({
  status: gate.status,
  gateVersion: gate.gateVersion,
  grade: gate.grade,
  score: gate.score,
  summary: gate.summary,
  failed: gate.failed,
}, null, 2));

if (gate.status === 'FAIL') {
  if (process.env.INSIGHT_QUALITY_STRICT === '1') {
    process.exit(1);
  }
  console.warn('[verify-real-insight] gate FAIL (observability only). Set INSIGHT_QUALITY_STRICT=1 to enforce.');
}

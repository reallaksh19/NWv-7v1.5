export interface RealInsightSnapshotParentMetric {
  parentId?: string;
  headline?: string;
  childCount?: number;
  angles?: string[];
  weakTree?: boolean;
  score?: number;
  postTreeScore?: number;
  temporalTiers?: string[];
  evolutionRoles?: string[];
  baseReportShare?: number;
}

export interface RealInsightSnapshotQualityReport {
  status?: string;
  grade?: string;
  parentCount?: number;
  avgAngles?: number;
  avgTemporalTiers?: number;
  avgEvolutionRoles?: number;
  baseReportShare?: number;
  multiAngleCount?: number;
  weakParentCount?: number;
  storyCount?: number;
  sourceGroupCount?: number;
  parents?: RealInsightSnapshotParentMetric[];
  warnings?: string[];
  errors?: string[];
}

export interface RealInsightSnapshotRatchetOptions {
  minParentCount: number;
  minAvgAngles: number;
  minAvgTemporalTiers: number;
  minAvgEvolutionRoles: number;
  maxBaseReportShare: number;
  minMultiAngleParents: number;
  minTopParentAngles: number;
  minTopParentChildren: number;
  maxWeakParentRatio: number;
  allowedGrades: string[];
}

export interface RealInsightSnapshotRatchetGate {
  status: "PASS" | "WARN" | "FAIL" | "SKIP";
  gateVersion: string;
  grade: string;
  score: number;
  passed: Array<{
    id: string;
    label: string;
    actual: unknown;
    required: unknown;
  }>;
  failed: Array<{
    id: string;
    label: string;
    actual: unknown;
    required: unknown;
    severity: "warn" | "fail";
    fix: string;
  }>;
  summary: {
    parentCount: number;
    avgAngles: number;
    avgTemporalTiers: number;
    avgEvolutionRoles: number;
    baseReportShare: number;
    multiAngleCount: number;
    weakParentCount: number;
    weakParentRatio: number;
    topParentAngles: number;
    topParentChildren: number;
    storyCount: number;
    sourceGroupCount: number;
  };
}

export const DEFAULT_REAL_INSIGHT_RATCHET: RealInsightSnapshotRatchetOptions = {
  minParentCount: 3,
  minAvgAngles: 1.4,
  minAvgTemporalTiers: 1.8,
  minAvgEvolutionRoles: 1.6,
  maxBaseReportShare: 0.55,
  minMultiAngleParents: 1,
  minTopParentAngles: 2,
  minTopParentChildren: 2,
  maxWeakParentRatio: 0.5,
  allowedGrades: ["A", "B", "C"],
};

function numberValue(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value: number, digits = 2): number {
  const scale = 10 ** digits;
  return Math.round(numberValue(value) * scale) / scale;
}

function normalizeGrade(value: unknown): string {
  const grade = String(value || "F").trim().toUpperCase();
  return grade || "F";
}

function uniqueVisibleAngles(parent: RealInsightSnapshotParentMetric | undefined): string[] {
  return Array.from(new Set(
    (Array.isArray(parent?.angles) ? parent?.angles : [])
      .map(angle => String(angle || "").trim())
      .filter(angle => angle && angle !== "unknown" && angle !== "unknown-angle")
  ));
}

function addGate(
  gate: RealInsightSnapshotRatchetGate,
  condition: boolean,
  payload: {
    id: string;
    label: string;
    actual: unknown;
    required: unknown;
    severity?: "warn" | "fail";
    fix: string;
  }
) {
  if (condition) {
    gate.passed.push({
      id: payload.id,
      label: payload.label,
      actual: payload.actual,
      required: payload.required,
    });
    return;
  }

  gate.failed.push({
    id: payload.id,
    label: payload.label,
    actual: payload.actual,
    required: payload.required,
    severity: payload.severity || "fail",
    fix: payload.fix,
  });
}

export function evaluateRealInsightSnapshotQualityRatchet(
  report: RealInsightSnapshotQualityReport,
  options: Partial<RealInsightSnapshotRatchetOptions> = {}
): RealInsightSnapshotRatchetGate {
  const cfg = {
    ...DEFAULT_REAL_INSIGHT_RATCHET,
    ...options,
  };

  if (!report || report.status === "SKIP") {
    return {
      status: "SKIP",
      gateVersion: "real-insight-snapshot-ratchet-v1",
      grade: "SKIP",
      score: 0,
      passed: [],
      failed: [],
      summary: {
        parentCount: 0,
        avgAngles: 0,
        avgTemporalTiers: 0,
        avgEvolutionRoles: 0,
        baseReportShare: 0,
        multiAngleCount: 0,
        weakParentCount: 0,
        weakParentRatio: 0,
        topParentAngles: 0,
        topParentChildren: 0,
        storyCount: 0,
        sourceGroupCount: 0,
      },
    };
  }

  const parents = Array.isArray(report.parents) ? report.parents : [];
  const topParent = parents[0];

  const topParentAngles = uniqueVisibleAngles(topParent).length;
  const topParentChildren = numberValue(topParent?.childCount);
  const parentCount = numberValue(report.parentCount, parents.length);
  const avgAngles = round(numberValue(report.avgAngles));
  const avgTemporalTiers = round(numberValue(report.avgTemporalTiers));
  const avgEvolutionRoles = round(numberValue(report.avgEvolutionRoles));
  const baseReportShare = round(numberValue(report.baseReportShare), 3);
  const multiAngleCount = numberValue(report.multiAngleCount);
  const weakParentCount = numberValue(report.weakParentCount);
  const storyCount = numberValue(report.storyCount);
  const sourceGroupCount = numberValue(report.sourceGroupCount);
  const weakParentRatio = parentCount ? round(weakParentCount / parentCount, 3) : 0;
  const grade = normalizeGrade(report.grade);
  const sparseSnapshot = storyCount < 12 || sourceGroupCount < 3;
  const strictSeverity: "warn" | "fail" = sparseSnapshot ? "warn" : "fail";

  const gate: RealInsightSnapshotRatchetGate = {
    status: "PASS",
    gateVersion: "real-insight-snapshot-ratchet-v1",
    grade,
    score: 100,
    passed: [],
    failed: [],
    summary: {
      parentCount,
      avgAngles,
      avgTemporalTiers,
      avgEvolutionRoles,
      baseReportShare,
      multiAngleCount,
      weakParentCount,
      weakParentRatio,
      topParentAngles,
      topParentChildren,
      storyCount,
      sourceGroupCount,
    },
  };

  addGate(gate, cfg.allowedGrades.includes(grade), {
    id: "grade-floor",
    label: "Real snapshot grade floor",
    actual: grade,
    required: cfg.allowedGrades.join("/"),
    severity: strictSeverity,
    fix: "Do not accept D/F real snapshot output. Improve child selection, parent rerank, or data intake.",
  });

  addGate(gate, parentCount >= cfg.minParentCount, {
    id: "parent-count",
    label: "Parent cluster count",
    actual: parentCount,
    required: ">= " + cfg.minParentCount,
    severity: strictSeverity,
    fix: "Real snapshot should produce enough parent clusters for useful Insight coverage.",
  });

  addGate(gate, avgAngles >= cfg.minAvgAngles, {
    id: "avg-angle-count",
    label: "Average visible angle count",
    actual: avgAngles,
    required: ">= " + cfg.minAvgAngles,
    severity: strictSeverity,
    fix: "Angle-diverse child selection is not strong enough on real data.",
  });

  addGate(gate, avgTemporalTiers >= cfg.minAvgTemporalTiers, {
    id: "avg-temporal-tier-count",
    label: "Average temporal tier count",
    actual: avgTemporalTiers,
    required: ">= " + cfg.minAvgTemporalTiers,
    severity: strictSeverity,
    fix: "C+E output should cover multiple event-time tiers, not only source buckets.",
  });

  addGate(gate, avgEvolutionRoles >= cfg.minAvgEvolutionRoles, {
    id: "avg-evolution-role-count",
    label: "Average evolution role count",
    actual: avgEvolutionRoles,
    required: ">= " + cfg.minAvgEvolutionRoles,
    severity: strictSeverity,
    fix: "C+E output should include distinct event evolution roles.",
  });

  addGate(gate, baseReportShare <= cfg.maxBaseReportShare, {
    id: "base-report-share",
    label: "Base report share",
    actual: baseReportShare,
    required: "<= " + cfg.maxBaseReportShare,
    severity: strictSeverity,
    fix: "Reduce base_report dominance by selecting stories with temporal, domain, or delta signal.",
  });

  addGate(gate, multiAngleCount >= cfg.minMultiAngleParents, {
    id: "multi-angle-parent-count",
    label: "Multi-angle parent count",
    actual: multiAngleCount,
    required: ">= " + cfg.minMultiAngleParents,
    severity: strictSeverity,
    fix: "At least one real parent must contain two or more visible angles.",
  });

  addGate(gate, topParentAngles >= cfg.minTopParentAngles, {
    id: "top-parent-angle-count",
    label: "Top parent angle count",
    actual: topParentAngles,
    required: ">= " + cfg.minTopParentAngles,
    severity: strictSeverity,
    fix: "Top Insight story is still single-angle. Demote it or enrich it.",
  });

  addGate(gate, topParentChildren >= cfg.minTopParentChildren, {
    id: "top-parent-child-depth",
    label: "Top parent child depth",
    actual: topParentChildren,
    required: ">= " + cfg.minTopParentChildren,
    severity: strictSeverity,
    fix: "Top Insight story has too few children. Useful-variant rescue should recover support stories.",
  });

  addGate(gate, weakParentRatio <= cfg.maxWeakParentRatio, {
    id: "weak-parent-ratio",
    label: "Weak parent ratio",
    actual: weakParentRatio,
    required: "<= " + cfg.maxWeakParentRatio,
    severity: "warn",
    fix: "Too many weak trees remain. Repair or demote weak trees after diversity repair.",
  });

  const failCount = gate.failed.filter(item => item.severity === "fail").length;
  const warnCount = gate.failed.filter(item => item.severity === "warn").length;

  gate.score = Math.max(0, 100 - failCount * 24 - warnCount * 10);
  gate.status = failCount > 0 ? "FAIL" : warnCount > 0 ? "WARN" : "PASS";

  return gate;
}

export function buildRealInsightRatchetMarkdown(gate: RealInsightSnapshotRatchetGate): string {
  const lines = [
    "## Real Snapshot Ratchet Gate",
    "",
    `- Status: **${gate.status}**`,
    `- Gate version: \`${gate.gateVersion}\``,
    `- Grade: \`${gate.grade}\``,
    `- Score: \`${gate.score}\``,
    `- Parents: \`${gate.summary.parentCount}\``,
    `- Average angles: \`${gate.summary.avgAngles}\``,
    `- Average temporal tiers: \`${gate.summary.avgTemporalTiers}\``,
    `- Average evolution roles: \`${gate.summary.avgEvolutionRoles}\``,
    `- Base report share: \`${gate.summary.baseReportShare}\``,
    `- Multi-angle parents: \`${gate.summary.multiAngleCount}\``,
    `- Top parent angles: \`${gate.summary.topParentAngles}\``,
    `- Top parent children: \`${gate.summary.topParentChildren}\``,
    "",
    "### Failed gates",
    "",
  ];

  if (!gate.failed.length) {
    lines.push("- None");
  } else {
    for (const failure of gate.failed) {
      lines.push(
        `- **${failure.label}** — actual \`${failure.actual}\`, required \`${failure.required}\`. Fix: ${failure.fix}`
      );
    }
  }

  lines.push("", "### Passed gates", "");

  for (const pass of gate.passed) {
    lines.push(`- ${pass.label}: \`${pass.actual}\` / \`${pass.required}\``);
  }

  return lines.join("\n") + "\n";
}

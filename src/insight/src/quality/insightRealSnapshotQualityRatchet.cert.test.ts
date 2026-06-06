import { describe, expect, it } from "vitest";
import {
  buildRealInsightRatchetMarkdown,
  evaluateRealInsightSnapshotQualityRatchet,
} from "./insightRealSnapshotQualityRatchet";

describe("Real Insight snapshot quality ratchet certification", () => {
  it("passes a real-quality style report with B/C or better metrics", () => {
    const gate = evaluateRealInsightSnapshotQualityRatchet({
      status: "PASS",
      grade: "B",
      parentCount: 5,
      avgAngles: 2.2,
      avgTemporalTiers: 2,
      avgEvolutionRoles: 2,
      baseReportShare: 0.25,
      multiAngleCount: 4,
      weakParentCount: 1,
      storyCount: 40,
      sourceGroupCount: 8,
      parents: [
        {
          parentId: "p1",
          headline: "Good parent",
          childCount: 3,
          angles: ["base_report", "official_response", "expert_analysis"],
          weakTree: false,
        },
      ],
    });

    expect(gate.status).toBe("PASS");
    expect(gate.failed).toHaveLength(0);
    expect(gate.score).toBe(100);
  });

  it("fails D/F grade even if raw report status is PASS", () => {
    const gate = evaluateRealInsightSnapshotQualityRatchet({
      status: "PASS",
      grade: "D",
      parentCount: 5,
      avgAngles: 2,
      avgTemporalTiers: 2,
      avgEvolutionRoles: 2,
      baseReportShare: 0.25,
      multiAngleCount: 2,
      weakParentCount: 0,
      storyCount: 30,
      sourceGroupCount: 7,
      parents: [
        {
          childCount: 3,
          angles: ["base_report", "official_response"],
        },
      ],
    });

    expect(gate.status).toBe("FAIL");
    expect(gate.failed.map(item => item.id)).toContain("grade-floor");
  });

  it("fails if top parent is still single-angle", () => {
    const gate = evaluateRealInsightSnapshotQualityRatchet({
      status: "PASS",
      grade: "C",
      parentCount: 5,
      avgAngles: 2,
      avgTemporalTiers: 2,
      avgEvolutionRoles: 2,
      baseReportShare: 0.25,
      multiAngleCount: 2,
      weakParentCount: 0,
      storyCount: 30,
      sourceGroupCount: 7,
      parents: [
        {
          childCount: 3,
          angles: ["base_report"],
        },
      ],
    });

    expect(gate.status).toBe("FAIL");
    expect(gate.failed.map(item => item.id)).toContain("top-parent-angle-count");
  });

  it("fails when average visible angles fall below the 1.4 secondary gate", () => {
    const gate = evaluateRealInsightSnapshotQualityRatchet({
      status: "PASS",
      grade: "C",
      parentCount: 5,
      avgAngles: 1.3,
      avgTemporalTiers: 2,
      avgEvolutionRoles: 2,
      baseReportShare: 0.25,
      multiAngleCount: 3,
      weakParentCount: 0,
      storyCount: 30,
      sourceGroupCount: 7,
      parents: [
        {
          childCount: 3,
          angles: ["base_report", "official_response"],
        },
      ],
    });

    expect(gate.status).toBe("FAIL");
    expect(gate.failed.map(item => item.id)).toContain("avg-angle-count");
  });

  it("fails when C+E temporal or role metrics are thin", () => {
    const gate = evaluateRealInsightSnapshotQualityRatchet({
      status: "PASS",
      grade: "C",
      parentCount: 5,
      avgAngles: 1.6,
      avgTemporalTiers: 1.2,
      avgEvolutionRoles: 1.1,
      baseReportShare: 0.25,
      multiAngleCount: 3,
      weakParentCount: 0,
      storyCount: 30,
      sourceGroupCount: 7,
      parents: [
        {
          childCount: 3,
          angles: ["base_report", "official_response"],
        },
      ],
    });

    expect(gate.status).toBe("FAIL");
    expect(gate.failed.map(item => item.id)).toContain("avg-temporal-tier-count");
    expect(gate.failed.map(item => item.id)).toContain("avg-evolution-role-count");
  });

  it("fails when base report share remains too high", () => {
    const gate = evaluateRealInsightSnapshotQualityRatchet({
      status: "PASS",
      grade: "C",
      parentCount: 5,
      avgAngles: 1.6,
      avgTemporalTiers: 2,
      avgEvolutionRoles: 2,
      baseReportShare: 0.8,
      multiAngleCount: 3,
      weakParentCount: 0,
      storyCount: 30,
      sourceGroupCount: 7,
      parents: [
        {
          childCount: 3,
          angles: ["base_report", "official_response"],
        },
      ],
    });

    expect(gate.status).toBe("FAIL");
    expect(gate.failed.map(item => item.id)).toContain("base-report-share");
  });

  it("warns for high weak-parent ratio when hard gates pass", () => {
    const gate = evaluateRealInsightSnapshotQualityRatchet({
      status: "PASS",
      grade: "C",
      parentCount: 4,
      avgAngles: 2,
      avgTemporalTiers: 2,
      avgEvolutionRoles: 2,
      baseReportShare: 0.25,
      multiAngleCount: 2,
      weakParentCount: 3,
      storyCount: 30,
      sourceGroupCount: 7,
      parents: [
        {
          childCount: 3,
          angles: ["base_report", "official_response"],
        },
      ],
    });

    expect(gate.status).toBe("WARN");
    expect(gate.failed.map(item => item.id)).toContain("weak-parent-ratio");
  });

  it("skips cleanly when no real snapshot is present", () => {
    const gate = evaluateRealInsightSnapshotQualityRatchet({
      status: "SKIP",
    });

    expect(gate.status).toBe("SKIP");
  });

  it("writes useful markdown", () => {
    const gate = evaluateRealInsightSnapshotQualityRatchet({
      status: "PASS",
      grade: "D",
      parentCount: 1,
      avgAngles: 1,
      multiAngleCount: 0,
      weakParentCount: 1,
      parents: [
        {
          childCount: 1,
          angles: ["base_report"],
        },
      ],
    });

    const markdown = buildRealInsightRatchetMarkdown(gate);

    expect(markdown).toContain("Real Snapshot Ratchet Gate");
    expect(markdown).toContain("Failed gates");
    expect(markdown).toContain("grade");
  });
});

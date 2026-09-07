import { describe, it, expect } from "vitest";
import { computeOptimizationComparison } from "@/lib/optimization/comparator";
import { UXAnalysisResult, UXFinding } from "@/lib/optimization/schemas";

function createMockAnalysis(overrides: Partial<UXAnalysisResult>): UXAnalysisResult {
  return {
    id: "test-analysis-id",
    timestamp: new Date().toISOString(),
    score: 70,
    severityCounts: { critical: 1, warning: 1, info: 0 },
    categoryCounts: { accessibility: 1, responsive: 1, hierarchy: 0, conversion: 0 },
    findings: [],
    viewport: "desktop",
    documentRevision: 1,
    ...overrides,
  };
}

const mockFinding1: UXFinding = {
  id: "img-alt",
  severity: "critical",
  category: "accessibility",
  title: "Images missing alt",
  recommendation: "Add descriptive alt",
  confidence: 1.0,
  affectedNodeIds: ["img-1"],
  evidence: "img element missing alt",
};

const mockFinding2: UXFinding = {
  id: "accessible-name",
  severity: "warning",
  category: "accessibility",
  title: "Button missing name",
  recommendation: "Add aria-label",
  confidence: 0.9,
  affectedNodeIds: ["btn-1"],
  evidence: "button has no text",
};

const mockNewCriticalFinding: UXFinding = {
  id: "heading-h1",
  severity: "critical",
  category: "hierarchy",
  title: "Missing h1",
  recommendation: "Add main h1",
  confidence: 1.0,
  affectedNodeIds: ["body-1"],
  evidence: "no h1 tag",
};

describe("computeOptimizationComparison", () => {
  it("computes score improvement and identifies resolved findings", () => {
    const baseline = createMockAnalysis({
      score: 72,
      findings: [mockFinding1, mockFinding2],
    });

    // Candidate fixed mockFinding1 (img-alt is absent)
    const candidate = createMockAnalysis({
      score: 84,
      findings: [mockFinding2],
    });

    const comparison = computeOptimizationComparison(baseline, candidate);

    expect(comparison.baselineScore).toBe(72);
    expect(comparison.candidateScore).toBe(84);
    expect(comparison.scoreDelta).toBe(12);
    expect(comparison.hasMeasurableImprovement).toBe(true);

    // mockFinding1 is resolved
    expect(comparison.resolvedFindingIds).toEqual(["img-alt"]);
    expect(comparison.resolvedFindings.length).toBe(1);
    expect(comparison.resolvedFindings[0].id).toBe("img-alt");

    // mockFinding2 is remaining
    expect(comparison.remainingFindingIds).toEqual(["accessible-name"]);
    expect(comparison.remainingFindings.length).toBe(1);

    // No new findings
    expect(comparison.newFindings.length).toBe(0);
    expect(comparison.hasNewCriticalIssues).toBe(false);
  });

  it("detects newly introduced findings and flags critical issues", () => {
    const baseline = createMockAnalysis({
      score: 80,
      findings: [mockFinding2],
    });

    // Candidate resolved mockFinding2, but introduced mockNewCriticalFinding
    const candidate = createMockAnalysis({
      score: 75,
      findings: [mockNewCriticalFinding],
    });

    const comparison = computeOptimizationComparison(baseline, candidate);

    expect(comparison.scoreDelta).toBe(-5);
    expect(comparison.hasMeasurableImprovement).toBe(false);

    expect(comparison.resolvedFindingIds).toEqual(["accessible-name"]);
    expect(comparison.newFindingIds).toEqual(["heading-h1"]);
    expect(comparison.hasNewCriticalIssues).toBe(true);
  });

  it("reports hasMeasurableImprovement: false when score is equal or lower", () => {
    const baseline = createMockAnalysis({
      score: 80,
      findings: [mockFinding2],
    });

    const candidate = createMockAnalysis({
      score: 80,
      findings: [mockFinding2],
    });

    const comparison = computeOptimizationComparison(baseline, candidate);

    expect(comparison.scoreDelta).toBe(0);
    expect(comparison.hasMeasurableImprovement).toBe(false);
    expect(comparison.remainingFindingIds).toEqual(["accessible-name"]);
    expect(comparison.resolvedFindings.length).toBe(0);
  });
});

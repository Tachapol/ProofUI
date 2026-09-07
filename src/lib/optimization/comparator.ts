import {
  UXAnalysisResult,
  OptimizationComparison,
  UXFinding,
} from "./schemas";

/**
 * Computes deterministic before/after comparison between baseline canonical analysis
 * and candidate analysis.
 *
 * Rules:
 * - Do not claim a finding is resolved unless it is absent in candidate analysis.
 * - Remaining findings are those present in both baseline and candidate.
 * - New findings are those present in candidate but absent in baseline.
 * - Flag newly introduced critical issues explicitly.
 */
export function computeOptimizationComparison(
  baseline: UXAnalysisResult,
  candidate: UXAnalysisResult
): OptimizationComparison {
  const baselineScore = baseline.score;
  const candidateScore = candidate.score;
  const scoreDelta = candidateScore - baselineScore;

  const candidateFindingMap = new Map<string, UXFinding>();
  candidate.findings.forEach((f) => {
    candidateFindingMap.set(f.id, f);
  });

  const baselineFindingMap = new Map<string, UXFinding>();
  baseline.findings.forEach((f) => {
    baselineFindingMap.set(f.id, f);
  });

  const resolvedFindings: UXFinding[] = [];
  const remainingFindings: UXFinding[] = [];
  const newFindings: UXFinding[] = [];

  // Categorize baseline findings
  baseline.findings.forEach((bFinding) => {
    if (!candidateFindingMap.has(bFinding.id)) {
      // Finding is strictly absent in candidate analysis => resolved
      resolvedFindings.push(bFinding);
    } else {
      // Still present in candidate analysis => remaining
      remainingFindings.push(bFinding);
    }
  });

  // Categorize candidate findings for new issues
  candidate.findings.forEach((cFinding) => {
    if (!baselineFindingMap.has(cFinding.id)) {
      // Was not present in baseline => newly introduced
      newFindings.push(cFinding);
    }
  });

  const hasNewCriticalIssues = newFindings.some(
    (f) => f.severity === "critical"
  );

  // A candidate has measurable improvement if score increased
  const hasMeasurableImprovement = scoreDelta > 0;

  return {
    baselineScore,
    candidateScore,
    scoreDelta,
    hasMeasurableImprovement,
    resolvedFindings,
    remainingFindings,
    newFindings,
    resolvedFindingIds: resolvedFindings.map((f) => f.id),
    remainingFindingIds: remainingFindings.map((f) => f.id),
    newFindingIds: newFindings.map((f) => f.id),
    hasNewCriticalIssues,
    baselineFindingCount: baseline.findings.length,
    candidateFindingCount: candidate.findings.length,
  };
}

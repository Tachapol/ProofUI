import {
  UXExperiment,
  ExperimentGoal,
  ExperimentVariant,
  ExperimentStatus,
} from "./schemas";

export interface VariantMetrics {
  variant: ExperimentVariant;
  versionId: string;
  sessions: number;
  ctaClicks: number;
  scroll100Count: number;
  conversions: number;
  conversionRate: number; // 0..1
}

export interface ExperimentEvaluationResult {
  experimentId: string;
  status: ExperimentStatus;
  goal: ExperimentGoal;
  control: VariantMetrics;
  variant: VariantMetrics;
  sampleSizeMet: boolean;
  minSampleSize: number;
  minSampleSizePerVariant: number;
  zScore: number;
  pValue: number;
  confidence: number; // 0..1 (e.g. 0.95 = 95%)
  confidenceThreshold: number;
  hasSufficientData: boolean;
  winner: "control" | "variant" | "insufficient_data" | "inconclusive";
  recommendedWinner: string | null; // versionId of winner or null
  recommendationSummary: string;
}

/**
 * High-precision approximation of the standard normal error function erf(x).
 * Based on Abramowitz & Stegun 7.1.26 (max error ~1.5e-7).
 */
export function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return sign * y;
}

/**
 * Standard Normal Cumulative Distribution Function Phi(z).
 */
export function normalCdf(z: number): number {
  return 0.5 * (1.0 + erf(z / Math.SQRT2));
}

/**
 * Computes two-tailed p-value for a given z-score.
 */
export function twoTailedPValue(z: number): number {
  const absZ = Math.abs(z);
  const cdf = normalCdf(absZ);
  const pValue = 2 * (1.0 - cdf);
  return Math.min(1.0, Math.max(0.0, pValue));
}

export interface RawVariantEvidence {
  sessions: number;
  ctaClicks: number;
  scroll100Count: number;
  goalConversions: number;
}

/** Two-sided Fisher exact test, summing tables no more likely than observed.
 * Definition/reference: https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.fisher_exact.html
 */
export function fisherExact(nC: number, convC: number, nV: number, convV: number): number {
  const total = nC + nV;
  if (!total) return 1;
  const factorial = [0];
  for (let i = 1; i <= total; i++) factorial[i] = factorial[i - 1] + Math.log(i);
  const choose = (n: number, k: number) => factorial[n] - factorial[k] - factorial[n - k];
  const successes = convC + convV;
  const probability = (x: number) => choose(nC, x) + choose(nV, successes - x) - choose(total, successes);
  const observed = probability(convC);
  let p = 0;
  for (let x = Math.max(0, successes - nV); x <= Math.min(nC, successes); x++) {
    const logP = probability(x);
    if (logP <= observed + 1e-9) p += Math.exp(logP);
  }
  return Math.min(1, p);
}

/**
 * Evaluates an experiment with statistical hypothesis testing (two-proportion z-test).
 * Strictly prevents claiming a winner if sample size is insufficient or confidence is below threshold.
 */
export function evaluateExperiment(
  experiment: UXExperiment,
  controlEvidence: RawVariantEvidence,
  variantEvidence: RawVariantEvidence
): ExperimentEvaluationResult {
  const minPerVariant = Math.max(2, Math.ceil(experiment.minSampleSize / 2));

  const nC = Math.max(0, controlEvidence.sessions);
  const nV = Math.max(0, variantEvidence.sessions);

  const convC = Math.max(0, Math.min(nC, controlEvidence.goalConversions));
  const convV = Math.max(0, Math.min(nV, variantEvidence.goalConversions));

  const rateC = nC > 0 ? convC / nC : 0;
  const rateV = nV > 0 ? convV / nV : 0;

  const controlMetrics: VariantMetrics = {
    variant: "control",
    versionId: experiment.controlVersionId,
    sessions: nC,
    ctaClicks: controlEvidence.ctaClicks,
    scroll100Count: controlEvidence.scroll100Count,
    conversions: convC,
    conversionRate: rateC,
  };

  const variantMetrics: VariantMetrics = {
    variant: "variant",
    versionId: experiment.variantVersionId,
    sessions: nV,
    ctaClicks: variantEvidence.ctaClicks,
    scroll100Count: variantEvidence.scroll100Count,
    conversions: convV,
    conversionRate: rateV,
  };

  const sampleSizeMet = nC >= minPerVariant && nV >= minPerVariant;

  // If sample size is not met, do not recommend any winner.
  if (!sampleSizeMet) {
    return {
      experimentId: experiment.id,
      status: experiment.status,
      goal: experiment.goal,
      control: controlMetrics,
      variant: variantMetrics,
      sampleSizeMet: false,
      minSampleSize: experiment.minSampleSize,
      minSampleSizePerVariant: minPerVariant,
      zScore: 0,
      pValue: 1.0,
      confidence: 0,
      confidenceThreshold: experiment.confidenceThreshold,
      hasSufficientData: false,
      winner: "insufficient_data",
      recommendedWinner: null,
      recommendationSummary: `Insufficient production data. Collected ${nC} control and ${nV} variant sessions (minimum ${minPerVariant} per variant needed).`,
    };
  }

  // Two-proportion pooled Z-test
  const pooledP = (convC + convV) / (nC + nV);
  const standardError = Math.sqrt(pooledP * (1.0 - pooledP) * (1.0 / nC + 1.0 / nV));

  let zScore = 0;
  let pValue = 1.0;
  let confidence = 0;

  if (standardError > 0) {
    zScore = (rateV - rateC) / standardError;
    pValue = twoTailedPValue(zScore);
    confidence = Math.max(0, 1.0 - pValue);
  } else if (rateC !== rateV) {
    // Edge case: one has 100% and one has 0%
    confidence = 0.999;
    pValue = 0.001;
    zScore = rateV > rateC ? 5 : -5;
  } else {
    // Both 0 or both identical
    zScore = 0;
    pValue = 1.0;
    confidence = 0;
  }

  // The store admits only the first predeclared quota per arm. No repeated looks
  // at an expanding sample. Legacy z-score remains descriptive for API compatibility.
  pValue = fisherExact(nC, convC, nV, convV);
  confidence = 1 - pValue; // compatibility field, NOT probability the winner is correct
  const meetsConfidence = pValue <= Math.min(0.05, 1 - experiment.confidenceThreshold);

  let winner: "control" | "variant" | "inconclusive" = "inconclusive";
  let recommendedWinner: string | null = null;
  let summary = "";

  if (meetsConfidence) {
    if (rateV > rateC) {
      winner = "variant";
      recommendedWinner = experiment.variantVersionId;
      const liftPercent = rateC > 0 ? (((rateV - rateC) / rateC) * 100).toFixed(1) : "+100";
      summary = `Variant won with ${(rateV * 100).toFixed(1)}% conversion vs ${(rateC * 100).toFixed(1)}% control (relative lift ${rateC > 0 ? `${liftPercent}%` : "undefined from zero baseline"}; two-sided Fisher p=${pValue.toPrecision(3)}). This is evidence for this goal and sample, not proof of overall UX improvement.`;
    } else if (rateC > rateV) {
      winner = "control";
      recommendedWinner = experiment.controlVersionId;
      const dropPercent = (((rateC - rateV) / (rateC || 1)) * 100).toFixed(1);
      summary = `Control outperformed variant (${(rateC * 100).toFixed(1)}% vs ${(rateV * 100).toFixed(1)}%, -${dropPercent}%; two-sided Fisher p=${pValue.toPrecision(3)}).`;
    } else {
      winner = "inconclusive";
      summary = `Both variants performed equally (${(rateC * 100).toFixed(1)}% conversion). Inconclusive result.`;
    }
  } else {
    winner = "inconclusive";
    summary = `Results inconclusive: two-sided Fisher p=${pValue.toPrecision(3)}, required p≤${Math.min(0.05, 1 - experiment.confidenceThreshold).toFixed(3)}. Fixed sample completed; do not extend this test to seek significance.`;
  }

  return {
    experimentId: experiment.id,
    status: experiment.status,
    goal: experiment.goal,
    control: controlMetrics,
    variant: variantMetrics,
    sampleSizeMet: true,
    minSampleSize: experiment.minSampleSize,
    minSampleSizePerVariant: minPerVariant,
    zScore,
    pValue,
    confidence,
    confidenceThreshold: experiment.confidenceThreshold,
    hasSufficientData: true,
    winner,
    recommendedWinner,
    recommendationSummary: summary,
  };
}

import { z } from "zod";
import { GenerationCandidateSchema } from "../generation/schemas";
import { UXAnalysisResultSchema } from "../optimization/schemas";

export const ReviewStateSchema = z.object({
  analysis: UXAnalysisResultSchema.nullable().default(null),
  candidates: z.array(GenerationCandidateSchema).default([]),
  activeCandidateId: z.string().nullable().default(null),
  selectedFindingIds: z.array(z.string()).default([]),
  decisions: z.array(z.object({
    candidateId: z.string(),
    baselineVersionId: z.string(),
    analysis: UXAnalysisResultSchema.nullable(),
    selectedFindingIds: z.array(z.string()).default([]),
    appliedVersionId: z.string().nullable().default(null),
  })).default([]),
});
export type ReviewState = z.infer<typeof ReviewStateSchema>;
export const EVIDENCE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export function evidenceIsStale(timestamp: string, now = Date.now()) {
  const time = Date.parse(timestamp);
  return !Number.isFinite(time) || now - time > EVIDENCE_MAX_AGE_MS;
}

export function nextReviewAction(state: {
  generated: boolean; candidate: boolean; staleCandidate: boolean;
  analyzed: boolean; staleAnalysis: boolean; unpublishedApplied: boolean;
  publishedCount: number; experiment: boolean;
}): "generate" | "compare" | "analyze" | "optimize" | "publish" | "experiment" | "review" {
  if (state.candidate && !state.staleCandidate) return "compare";
  if (!state.generated) return "generate";
  if (state.unpublishedApplied) return "publish";
  if (state.experiment) return "review";
  if (state.publishedCount >= 2) return "experiment";
  if (!state.analyzed || state.staleAnalysis || state.staleCandidate) return "analyze";
  return "optimize";
}

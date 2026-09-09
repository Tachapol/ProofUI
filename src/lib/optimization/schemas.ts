import { z } from "zod";

export const UXSeveritySchema = z.enum(["info", "warning", "critical"]);
export type UXSeverity = z.infer<typeof UXSeveritySchema>;

export const UXCategorySchema = z.enum([
  "accessibility",
  "responsive",
  "hierarchy",
  "conversion",
]);
export type UXCategory = z.infer<typeof UXCategorySchema>;

export const UXAnalysisViewportSchema = z.enum(["desktop", "tablet", "mobile"]);
export type UXAnalysisViewport = z.infer<typeof UXAnalysisViewportSchema>;

export const UXFindingSchema = z.object({
  id: z.string(),
  severity: UXSeveritySchema,
  category: UXCategorySchema,
  title: z.string(),
  recommendation: z.string(),
  confidence: z.number().min(0).max(1),
  affectedNodeIds: z.array(z.string()),
  evidence: z.string(),
});
export type UXFinding = z.infer<typeof UXFindingSchema>;

export const UXAnalysisSeverityCountsSchema = z.object({
  critical: z.number(),
  warning: z.number(),
  info: z.number(),
});
export type UXAnalysisSeverityCounts = z.infer<
  typeof UXAnalysisSeverityCountsSchema
>;

export const UXAnalysisCategoryCountsSchema = z.object({
  accessibility: z.number(),
  responsive: z.number(),
  hierarchy: z.number(),
  conversion: z.number(),
});
export type UXAnalysisCategoryCounts = z.infer<
  typeof UXAnalysisCategoryCountsSchema
>;

export const UXAnalysisResultSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  score: z.number().min(0).max(100),
  severityCounts: UXAnalysisSeverityCountsSchema,
  categoryCounts: UXAnalysisCategoryCountsSchema,
  findings: z.array(UXFindingSchema),
  viewport: UXAnalysisViewportSchema,
  documentRevision: z.number(),
});
export type UXAnalysisResult = z.infer<typeof UXAnalysisResultSchema>;

export const UXAnalyzeRequestSchema = z.object({
  html: z.string().min(1, "HTML document is required"),
  viewport: UXAnalysisViewportSchema.default("desktop"),
  revision: z.number().int().default(1),
  liveEvidence: z.any().optional().nullable(),
  experimentEvidence: z.any().optional().nullable(),
});
export type UXAnalyzeRequest = z.infer<typeof UXAnalyzeRequestSchema>;

export const UXAnalyzeStageSchema = z.enum([
  "Preparing document",
  "Accessibility",
  "Responsive",
  "Hierarchy",
  "Complete",
]);
export type UXAnalyzeStage = z.infer<typeof UXAnalyzeStageSchema>;

export const UXAnalyzeStreamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("status"),
    stage: UXAnalyzeStageSchema,
    message: z.string().optional(),
  }),
  z.object({
    type: z.literal("result"),
    result: UXAnalysisResultSchema,
  }),
  z.object({
    type: z.literal("complete"),
  }),
  z.object({
    type: z.literal("error"),
    error: z.string(),
  }),
]);
export type UXAnalyzeStreamEvent = z.infer<typeof UXAnalyzeStreamEventSchema>;

export const AUTOMATABLE_FINDING_IDS = new Set([
  "img-alt",
  "accessible-name",
  "heading-h1",
  "heading-levels",
  "missing-main",
  "mobile-overflow",
  "touch-target",
  "cta-heuristic",
]);

export function isFindingAutomatable(finding: UXFinding): boolean {
  return AUTOMATABLE_FINDING_IDS.has(finding.id) || finding.confidence > 0;
}

export const UXOptimizationRequestSchema = z.object({
  html: z.string().min(1, "HTML document is required"),
  revision: z.number().int().default(1),
  viewport: UXAnalysisViewportSchema.default("desktop"),
  selectedFindingIds: z.array(z.string()).min(1, "At least one finding must be selected"),
  selectedFindings: z.array(UXFindingSchema).min(1, "At least one finding must be selected"),
  userGoal: z.string().max(500).optional(),
});
export type UXOptimizationRequest = z.infer<typeof UXOptimizationRequestSchema>;

export const UXOptimizationStageSchema = z.enum([
  "Preparing context",
  "Analyzing selected findings",
  "Generating optimization",
  "Sanitizing candidate",
  "Comparing evidence",
  "Complete",
]);
export type UXOptimizationStage = z.infer<typeof UXOptimizationStageSchema>;

export const OptimizationComparisonSchema = z.object({
  baselineScore: z.number().min(0).max(100),
  candidateScore: z.number().min(0).max(100),
  scoreDelta: z.number(),
  hasMeasurableImprovement: z.boolean(),
  resolvedFindings: z.array(UXFindingSchema),
  remainingFindings: z.array(UXFindingSchema),
  newFindings: z.array(UXFindingSchema),
  resolvedFindingIds: z.array(z.string()),
  remainingFindingIds: z.array(z.string()),
  newFindingIds: z.array(z.string()),
  hasNewCriticalIssues: z.boolean(),
  baselineFindingCount: z.number(),
  candidateFindingCount: z.number(),
});
export type OptimizationComparison = z.infer<typeof OptimizationComparisonSchema>;

export const UXOptimizationStreamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("status"),
    stage: UXOptimizationStageSchema,
    message: z.string().optional(),
  }),
  z.object({
    type: z.literal("result"),
    candidateHtml: z.string(),
    summary: z.string(),
    warnings: z.array(z.string()),
    comparison: OptimizationComparisonSchema.optional(),
  }),
  z.object({
    type: z.literal("complete"),
  }),
  z.object({
    type: z.literal("error"),
    error: z.string(),
  }),
]);
export type UXOptimizationStreamEvent = z.infer<typeof UXOptimizationStreamEventSchema>;


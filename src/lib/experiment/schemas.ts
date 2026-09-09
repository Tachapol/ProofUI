import { z } from "zod";

// ─── Goal Schemas ─────────────────────────────────────────────────────────

export const ExperimentGoalTypeSchema = z.enum(["cta_click", "scroll_completion"]);
export type ExperimentGoalType = z.infer<typeof ExperimentGoalTypeSchema>;

export const ExperimentGoalSchema = z.object({
  type: ExperimentGoalTypeSchema,
  // Optional specific data-editor-id of the target CTA (or undefined for any CTA)
  targetCtaId: z.string().max(64).optional(),
  // Scroll threshold: 25 | 50 | 75 | 100 (defaults to 100% completion)
  thresholdScroll: z.union([z.literal(25), z.literal(50), z.literal(75), z.literal(100)]).default(100),
});
export type ExperimentGoal = z.infer<typeof ExperimentGoalSchema>;

// ─── Experiment Status ───────────────────────────────────────────────────

export const ExperimentStatusSchema = z.enum(["draft", "running", "concluded"]);
export type ExperimentStatus = z.infer<typeof ExperimentStatusSchema>;

// ─── UX Experiment Schema ────────────────────────────────────────────────

export const UXExperimentSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_\-]+$/),
  projectId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_\-]+$/),
  pageId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_\-]+$/),
  name: z.string().min(1).max(256),
  controlVersionId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_\-]+$/),
  variantVersionId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_\-]+$/),
  status: ExperimentStatusSchema.default("running"),
  goal: ExperimentGoalSchema,
  trafficSplit: z.number().int().min(1).max(99).default(50),
  minSampleSize: z.number().int().min(4).max(100000).default(20), // total sessions needed across both
  confidenceThreshold: z.number().min(0.5).max(0.999).default(0.95), // 95% default
  startedAt: z.string(),
  endedAt: z.string().nullable().default(null),
  promotedVersionId: z.string().nullable().default(null),
});
export type UXExperiment = z.infer<typeof UXExperimentSchema>;

// ─── Create Experiment Request Schema ────────────────────────────────────

export const CreateExperimentRequestSchema = z
  .object({
    projectId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_\-]+$/),
    pageId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_\-]+$/),
    name: z.string().min(1).max(256),
    controlVersionId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_\-]+$/),
    variantVersionId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_\-]+$/),
    goal: ExperimentGoalSchema,
    trafficSplit: z.number().int().min(1).max(99).optional().default(50),
    minSampleSize: z.number().int().min(4).max(100000).optional().default(20),
    confidenceThreshold: z.number().min(0.5).max(0.999).optional().default(0.95),
  })
  .strict()
  .refine((data) => data.controlVersionId !== data.variantVersionId, {
    message: "Control and Variant version IDs must be distinct",
    path: ["variantVersionId"],
  });
export type CreateExperimentRequest = z.input<typeof CreateExperimentRequestSchema>;

// ─── Promote Winner Request Schema ───────────────────────────────────────

export const PromoteWinnerRequestSchema = z
  .object({
    confirmed: z.literal(true, {
      message: "Explicit confirmation (confirmed: true) is strictly required to promote a winner",
    }),
    versionId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_\-]+$/),
  })
  .strict();
export type PromoteWinnerRequest = z.infer<typeof PromoteWinnerRequestSchema>;

// ─── Variant Variant Type ────────────────────────────────────────────────

export type ExperimentVariant = "control" | "variant";

// ─── Deterministic Assignment Algorithm ──────────────────────────────────

/**
 * 32-bit FNV-1a non-cryptographic hash.
 * Provides uniform, fast, and deterministic dispersion.
 */
export function fnv1aHash(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Deterministically assigns a visitor/session to either 'control' or 'variant'.
 * Invariant: For any given (experimentId, clientToken, trafficSplit), the result is immutable.
 * Uses zero cookies, zero PII, and zero cross-site state.
 */
export function assignVariant(
  experimentId: string,
  clientToken: string,
  trafficSplit: number = 50
): ExperimentVariant {
  if (!clientToken || clientToken.trim().length === 0) {
    return "control";
  }
  const hash = fnv1aHash(`${experimentId}::${clientToken}`);
  const bucket = hash % 100; // 0..99
  return bucket < trafficSplit ? "control" : "variant";
}

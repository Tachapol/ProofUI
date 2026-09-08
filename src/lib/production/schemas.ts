import { z } from "zod";
import { UXAnalysisViewportSchema } from "../optimization/schemas";

// ─── Version & Constants ──────────────────────────────────────────────────

export const PROOFUI_TRACKER_VERSION = "1.0.0";
export const MAX_PAYLOAD_SIZE_BYTES = 32 * 1024; // 32 KB limit
export const MAX_TRACKED_CLICKS_PER_SESSION = 200;
export const MAX_CTA_CLICKS_PER_SESSION = 100;

// ─── Published Metadata ───────────────────────────────────────────────────

export const PublishedMetadataSchema = z.object({
  projectId: z.string().min(1).max(128),
  pageId: z.string().min(1).max(128),
  versionId: z.string().min(1).max(128),
  publishedAt: z.string(),
  title: z.string().max(256),
  trackingEnabled: z.boolean(),
  trackingVersion: z.string().max(32),
  endpointUrl: z.string().max(256),
});
export type PublishedMetadata = z.infer<typeof PublishedMetadataSchema>;

// ─── Session Duration Buckets ─────────────────────────────────────────────

export const SessionDurationBucketSchema = z.enum([
  "<15s",
  "15-30s",
  "30-60s",
  "1-3m",
  ">3m",
]);
export type SessionDurationBucket = z.infer<typeof SessionDurationBucketSchema>;

export function getDurationBucket(ms: number): SessionDurationBucket {
  const seconds = ms / 1000;
  if (seconds < 15) return "<15s";
  if (seconds < 30) return "15-30s";
  if (seconds < 60) return "30-60s";
  if (seconds < 180) return "1-3m";
  return ">3m";
}

// ─── Scroll Depth ─────────────────────────────────────────────────────────

export const ProductionScrollDepthSchema = z.object({
  reached25: z.boolean(),
  reached50: z.boolean(),
  reached75: z.boolean(),
  reached100: z.boolean(),
});
export type ProductionScrollDepth = z.infer<typeof ProductionScrollDepthSchema>;

// ─── Strictly Validated Telemetry Ingestion Payload ───────────────────────
// We explicitly use .strict() to reject any unexpected or extraneous fields.
// In addition, we disallow any forbidden keys or PII patterns.

export const FORBIDDEN_PAYLOAD_KEYS = new Set([
  "password",
  "pass",
  "formValue",
  "formValues",
  "formData",
  "value",
  "values",
  "cookie",
  "cookies",
  "localStorage",
  "sessionStorage",
  "queryParams",
  "query",
  "searchParams",
  "ip",
  "ipAddress",
  "text",
  "fullText",
  "textContent",
  "email",
  "userId",
  "fingerprint",
]);

export const ProductionTelemetryPayloadSchema = z
  .object({
    projectId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_\-]+$/, "Invalid projectId format"),
    pageId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_\-]+$/, "Invalid pageId format"),
    versionId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_\-]+$/, "Invalid versionId format"),
    sessionId: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_\-]+$/, "Invalid sessionId format"),
    viewport: UXAnalysisViewportSchema,
    sessionDurationBucket: SessionDurationBucketSchema,
    scrollDepth: ProductionScrollDepthSchema,
    // CTA clicks by data-editor-id: Record<editorId, count>
    ctaClicks: z.record(
      z.string().min(1).max(64).regex(/^[a-zA-Z0-9_\-]+$/),
      z.number().int().min(1).max(1000)
    ).optional().default({}),
    // Element clicks by data-editor-id: Record<editorId, count>
    elementClicks: z.record(
      z.string().min(1).max(64).regex(/^[a-zA-Z0-9_\-]+$/),
      z.number().int().min(1).max(1000)
    ).optional().default({}),
    // Client tracker version
    trackerVersion: z.string().max(32).default(PROOFUI_TRACKER_VERSION),
  })
  .strict()
  .refine(
    (data) => {
      const ctaKeys = Object.keys(data.ctaClicks || {});
      const elementKeys = Object.keys(data.elementClicks || {});
      return (
        ctaKeys.length <= MAX_CTA_CLICKS_PER_SESSION &&
        elementKeys.length <= MAX_TRACKED_CLICKS_PER_SESSION
      );
    },
    { message: "Payload exceeds maximum allowable click events" }
  );

export type ProductionTelemetryPayload = z.infer<typeof ProductionTelemetryPayloadSchema>;

// ─── Aggregated Production Evidence ───────────────────────────────────────

export const AggregatedProductionEvidenceSchema = z.object({
  projectId: z.string(),
  pageId: z.string(),
  versionId: z.string(),
  totalSessions: z.number(),
  viewportDistribution: z.record(UXAnalysisViewportSchema, z.number()),
  durationBuckets: z.record(SessionDurationBucketSchema, z.number()),
  scrollDepthDistribution: z.object({
    reached25: z.number(),
    reached50: z.number(),
    reached75: z.number(),
    reached100: z.number(),
  }),
  ctaClickCounts: z.record(z.string(), z.number()),
  elementClickCounts: z.record(z.string(), z.number()),
  mostClickedElements: z.array(
    z.object({
      editorId: z.string(),
      count: z.number(),
    })
  ),
  lowInteractionImportantElements: z.array(
    z.object({
      editorId: z.string(),
      reason: z.string(),
    })
  ),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
});
export type AggregatedProductionEvidence = z.infer<typeof AggregatedProductionEvidenceSchema>;

// ─── Publish API Request & Response ───────────────────────────────────────

export const PublishRequestSchema = z
  .object({
    projectId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_\-]+$/),
    pageId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_\-]+$/),
    versionId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_\-]+$/),
    title: z.string().min(1).max(256),
    html: z.string().min(1, "HTML content is required"),
    trackingEnabled: z.boolean().default(false),
  })
  .strict();
export type PublishRequest = z.infer<typeof PublishRequestSchema>;

export const PublishResponseSchema = z.object({
  success: z.boolean(),
  metadata: PublishedMetadataSchema,
  publishedUrl: z.string(),
  html: z.string(),
});
export type PublishResponse = z.infer<typeof PublishResponseSchema>;

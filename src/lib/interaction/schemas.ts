import { z } from "zod";
import { UXAnalysisViewportSchema } from "../optimization/schemas";

// ─── Interaction Event Types ──────────────────────────────────────────────

export const InteractionEventTypeSchema = z.enum([
  "click",
  "cta_click",
  "scroll_depth",
  "form_focus",
  "form_change",
  "time_on_page",
]);
export type InteractionEventType = z.infer<typeof InteractionEventTypeSchema>;

export const InteractionEventMetadataSchema = z.object({
  scrollPercent: z.number().min(0).max(100).optional(),
  isCta: z.boolean().optional(),
  formFieldType: z.string().optional(),
});
export type InteractionEventMetadata = z.infer<typeof InteractionEventMetadataSchema>;

export const InteractionEventSchema = z.object({
  type: InteractionEventTypeSchema,
  editorId: z.string(),
  tagName: z.string(),
  timestamp: z.number(),
  viewport: UXAnalysisViewportSchema,
  metadata: InteractionEventMetadataSchema.optional(),
});
export type InteractionEvent = z.infer<typeof InteractionEventSchema>;

// ─── Scroll Depth Thresholds ──────────────────────────────────────────────

export const ScrollDepthSchema = z.object({
  reached25: z.boolean(),
  reached50: z.boolean(),
  reached75: z.boolean(),
  reached100: z.boolean(),
});
export type ScrollDepth = z.infer<typeof ScrollDepthSchema>;

// ─── Session Summary ──────────────────────────────────────────────────────

export const InteractionSessionSummarySchema = z.object({
  sessionId: z.string(),
  startedAt: z.number(),
  endedAt: z.number().nullable(),
  viewport: UXAnalysisViewportSchema,
  totalEvents: z.number(),
  scrollDepth: ScrollDepthSchema,
  timeOnPageMs: z.number(),
  ctaClicks: z.record(z.string(), z.number()),
  elementClicks: z.record(z.string(), z.number()),
  mostClickedElements: z.array(
    z.object({
      editorId: z.string(),
      tagName: z.string(),
      count: z.number(),
    })
  ),
  elementsWithNoInteraction: z.array(z.string()),
  formInteractions: z.record(
    z.string(),
    z.object({
      focusCount: z.number(),
      changeCount: z.number(),
      fieldType: z.string().optional(),
    })
  ),
});
export type InteractionSessionSummary = z.infer<typeof InteractionSessionSummarySchema>;

// ─── Constants ────────────────────────────────────────────────────────────

/** Maximum number of events tracked per session to prevent memory issues. */
export const MAX_EVENTS_PER_SESSION = 10_000;

/** CTA detection heuristic tag names and roles. */
export const CTA_TAG_NAMES = new Set(["button", "a"]);
export const CTA_ROLES = new Set(["button", "link"]);
export const CTA_CLASS_HINTS = [
  "cta",
  "btn",
  "button",
  "action",
  "submit",
  "signup",
  "sign-up",
  "get-started",
  "try-free",
  "download",
];

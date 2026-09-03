import { z } from "zod";

// Evidence model linking claims to extracted source
export const ExtractionEvidenceSchema = z.object({
  id: z.string(),
  category: z.enum(["structure", "style", "asset", "motion", "accessibility", "framework"]),
  source: z.enum(["dom", "computed-style", "stylesheet", "metadata", "screenshot-analysis", "heuristic"]),
  nodeIds: z.array(z.string()).optional(),
  property: z.string().optional(),
  rawValue: z.string().optional(),
  description: z.string(),
  confidence: z.number().min(0).max(1),
});
export type ExtractionEvidence = z.infer<typeof ExtractionEvidenceSchema>;

// Reduced semantic node in DOM extraction
export const ExtractedNodeSchema: z.ZodType<ExtractedNode> = z.lazy(() =>
  z.object({
    captureId: z.string(),
    tagName: z.string(),
    role: z.string().optional(),
    semanticLabel: z.string().optional(),
    textPreview: z.string().optional(),
    attributes: z.record(z.string(), z.string()),
    rect: z
      .object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
      })
      .optional(),
    visibility: z.enum(["visible", "hidden", "offscreen"]),
    children: z.array(ExtractedNodeSchema),
  })
);
export interface ExtractedNode {
  captureId: string;
  tagName: string;
  role?: string;
  semanticLabel?: string;
  textPreview?: string;
  attributes: Record<string, string>;
  rect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  visibility: "visible" | "hidden" | "offscreen";
  children: ExtractedNode[];
}

export const ExtractedStructureSchema = z.object({
  root: ExtractedNodeSchema,
  totalNodeCount: z.number(),
  maxDepth: z.number(),
  headings: z.array(
    z.object({
      level: z.number(),
      text: z.string(),
      captureId: z.string(),
    })
  ),
  landmarks: z.array(
    z.object({
      tag: z.string(),
      role: z.string().optional(),
      captureId: z.string(),
    })
  ),
});
export type ExtractedStructure = z.infer<typeof ExtractedStructureSchema>;

// Design Token Candidates & Aggregated System
export const TokenCandidateSchema = z.object({
  value: z.string(),
  frequency: z.number(),
  sampleNodeIds: z.array(z.string()),
  confidence: z.number(),
  evidence: z.array(z.string()),
});
export type TokenCandidate = z.infer<typeof TokenCandidateSchema>;

export const ExtractedDesignTokensSchema = z.object({
  colors: z.object({
    primary: TokenCandidateSchema.optional(),
    secondary: TokenCandidateSchema.optional(),
    accent: TokenCandidateSchema.optional(),
    background: TokenCandidateSchema.optional(),
    surface: TokenCandidateSchema.optional(),
    textPrimary: TokenCandidateSchema.optional(),
    textMuted: TokenCandidateSchema.optional(),
    border: TokenCandidateSchema.optional(),
    allSampled: z.array(TokenCandidateSchema),
  }),
  typography: z.object({
    fontFamilies: z.array(TokenCandidateSchema),
    fontSizeScale: z.array(TokenCandidateSchema),
    fontWeights: z.array(TokenCandidateSchema),
    lineHeights: z.array(TokenCandidateSchema),
  }),
  spacing: z.object({
    paddingScale: z.array(TokenCandidateSchema),
    gapScale: z.array(TokenCandidateSchema),
    containerWidths: z.array(TokenCandidateSchema),
  }),
  radii: z.array(TokenCandidateSchema),
  shadows: z.array(TokenCandidateSchema),
});
export type ExtractedDesignTokens = z.infer<typeof ExtractedDesignTokensSchema>;

// Component Inference Signals
export const ComponentSignalSchema = z.object({
  kind: z.string(),
  captureNodeId: z.string(),
  confidence: z.number(),
  evidence: z.array(z.string()),
});
export type ComponentSignal = z.infer<typeof ComponentSignalSchema>;

// Motion Signals
export const MotionSignalSchema = z.object({
  kind: z.enum([
    "css-animation",
    "css-transition",
    "sticky",
    "fixed",
    "reduced-motion-support",
    "library-signal",
  ]),
  nodeId: z.string().optional(),
  value: z.string().optional(),
  confidence: z.number(),
  evidence: z.array(z.string()),
});
export type MotionSignal = z.infer<typeof MotionSignalSchema>;

// Accessibility Signals
export const AccessibilitySignalSchema = z.object({
  observation: z.string(),
  type: z.enum(["info", "warning", "positive"]),
  confidence: z.number(),
  evidence: z.array(z.string()),
});
export type AccessibilitySignal = z.infer<typeof AccessibilitySignalSchema>;

// Framework Signals
export const FrameworkSignalSchema = z.object({
  name: z.string(),
  confidence: z.number(),
  evidence: z.array(z.string()),
});
export type FrameworkSignal = z.infer<typeof FrameworkSignalSchema>;

// Asset Manifest
export const AssetManifestEntrySchema = z.object({
  id: z.string(),
  originalUrl: z.string(),
  normalizedUrl: z.string(),
  type: z.enum(["image", "icon", "background", "font", "video-poster", "other"]),
  sourceContext: z.enum([
    "img[src]",
    "srcset",
    "css-url",
    "favicon",
    "og:image",
    "twitter:image",
    "poster",
  ]),
  alt: z.string().optional(),
  nearbyText: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  mimeType: z.string().optional(),
  downloadable: z.boolean(),
  warning: z.string().optional(),
});
export type AssetManifestEntry = z.infer<typeof AssetManifestEntrySchema>;

// Capture Warnings
export const CaptureWarningSchema = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  nodeId: z.string().optional(),
});
export type CaptureWarning = z.infer<typeof CaptureWarningSchema>;

// Resource Limits Report
export const CaptureLimitReportSchema = z.object({
  totalDurationMs: z.number(),
  totalNodesSampled: z.number(),
  totalStylesSampled: z.number(),
  totalAssetsDiscovered: z.number(),
  screenshotTruncated: z.boolean(),
  hiddenOverlaysCount: z.number(),
});
export type CaptureLimitReport = z.infer<typeof CaptureLimitReportSchema>;

// Complete Capture Package
export const CapturePackageSchema = z.object({
  id: z.string(),
  requestedUrl: z.string(),
  finalUrl: z.string(),
  title: z.string(),
  description: z.string().optional(),
  capturedAt: z.string(),
  viewport: z.object({
    width: z.number(),
    height: z.number(),
    deviceScaleFactor: z.number(),
  }),
  screenshot: z.object({
    pathOrUrl: z.string(),
    thumbnailPathOrUrl: z.string(),
    width: z.number(),
    height: z.number(),
    format: z.enum(["png", "webp"]),
    strategy: z.enum(["native-full-page", "scroll-stitch"]),
    truncated: z.boolean(),
  }),
  structure: ExtractedStructureSchema,
  designTokens: ExtractedDesignTokensSchema,
  components: z.array(ComponentSignalSchema),
  motion: z.array(MotionSignalSchema),
  accessibility: z.array(AccessibilitySignalSchema),
  frameworks: z.array(FrameworkSignalSchema),
  assets: z.array(AssetManifestEntrySchema),
  sanitizedHtml: z.string(),
  designMarkdown: z.string(),
  evidence: z.array(ExtractionEvidenceSchema),
  warnings: z.array(CaptureWarningSchema),
  limits: CaptureLimitReportSchema,
});
export type CapturePackage = z.infer<typeof CapturePackageSchema>;

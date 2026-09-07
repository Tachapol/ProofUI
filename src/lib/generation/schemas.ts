import { z } from "zod";
import { CapturePackageSchema } from "../import/schemas";
import { CodeDiagnosticSchema } from "../code/diagnostics";

// Document Versioning Metadata
export const DocumentVersionSourceSchema = z.enum([
  "initial",
  "manual",
  "code",
  "ai-edit",
  "ai-generation",
  "website-import",
  "restored",
]);
export type DocumentVersionSource = z.infer<typeof DocumentVersionSourceSchema>;

export const DocumentVersionSchema = z.object({
  id: z.string(),
  parentVersionId: z.string().nullable(),
  source: DocumentVersionSourceSchema,
  revision: z.number(),
  htmlReference: z.string(),
  conversationId: z.string().optional(),
  messageId: z.string().optional(),
  instruction: z.string().optional(),
  summary: z.string(),
  createdAt: z.string(),
});
export type DocumentVersion = z.infer<typeof DocumentVersionSchema>;

// Source Precedence Report
export const SourcePrecedenceReportSchema = z.object({
  sources: z.array(
    z.object({
      sourceId: z.string(),
      role: z.enum([
        "user-goal",
        "primary-visual",
        "primary-structure",
        "secondary-design-system",
        "current-document",
        "supplemental-guidance",
      ]),
    })
  ),
  conflicts: z.array(
    z.object({
      category: z.string(),
      winningSourceId: z.string(),
      ignoredSourceIds: z.array(z.string()),
      explanation: z.string(),
    })
  ),
});
export type SourcePrecedenceReport = z.infer<typeof SourcePrecedenceReportSchema>;

// Page Generation Request
export const PageGenerationRequestSchema = z.object({
  requestId: z.string(),
  conversationId: z.string(),
  instruction: z.string(),
  scope: z.enum(["new_page", "new_version"]),
  basedOnRevision: z.number(),
  attachmentIds: z.array(z.string()),
  context: z.object({
    currentDocument: z
      .object({
        revision: z.number(),
        outline: z.array(z.string()),
        html: z.string().optional(),
      })
      .optional(),
    screenshotReference: z.string().optional(),
    designMarkdown: z.string().optional(),
    capturedStructure: CapturePackageSchema.shape.structure.optional(),
    designTokens: CapturePackageSchema.shape.designTokens.optional(),
    assets: CapturePackageSchema.shape.assets.optional(),
  }),
  provider: z.enum(["qwen", "gemini", "mock"]).optional(),
});
export type PageGenerationRequest = z.infer<typeof PageGenerationRequestSchema>;

// Qwen Structured Output Schema
export const QwenGenerationOutputSchema = z.object({
  summary: z.string().min(1).max(1000),
  html: z.string().min(1).max(500_000),
  warnings: z.array(z.string().max(500)).max(20),
});
export type QwenGenerationOutput = z.infer<typeof QwenGenerationOutputSchema>;

// Safe Generation Error Codes
export const GenerationErrorCodeSchema = z.enum([
  "PROVIDER_NOT_CONFIGURED",
  "PROVIDER_AUTHENTICATION_FAILED",
  "PROVIDER_RATE_LIMITED",
  "PROVIDER_TIMEOUT",
  "PROVIDER_REQUEST_FAILED",
  "PROVIDER_INVALID_OUTPUT",
  "ATTACHMENT_NOT_FOUND",
  "ATTACHMENT_TOO_LARGE",
  "ATTACHMENT_INVALID_DIMENSIONS",
  "UNSUPPORTED_MIME",
  "GENERATED_HTML_INVALID",
  "GENERATION_CANCELED",
]);
export type GenerationErrorCode = z.infer<typeof GenerationErrorCodeSchema>;

// Page Generation Result
export const PageGenerationResultSchema = z.object({
  id: z.string(),
  requestId: z.string(),
  conversationId: z.string(),
  basedOnRevision: z.number(),
  scope: z.enum(["new_page", "new_version"]),
  summary: z.string(),
  html: z.string(),
  warnings: z.array(z.string()),
  attachmentIds: z.array(z.string()),
  sourcePrecedence: SourcePrecedenceReportSchema,
  validation: z.object({
    valid: z.boolean(),
    diagnostics: z.array(CodeDiagnosticSchema),
  }),
  providerName: z.string().optional(),
  modelName: z.string().optional(),
  createdAt: z.string(),
});
export type PageGenerationResult = z.infer<typeof PageGenerationResultSchema>;

// Generation Candidate in Editor
export const GenerationCandidateSchema = z.object({
  result: PageGenerationResultSchema,
  sanitizedHtml: z.string(),
  parentGenerationId: z.string().optional(),
  status: z.enum(["ready", "applied", "rejected", "stale"]),
});
export type GenerationCandidate = z.infer<typeof GenerationCandidateSchema>;

// Streaming Events
export const GenerationStreamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("status"),
    requestId: z.string(),
    stage: z.string(),
  }),
  z.object({
    type: z.literal("result"),
    requestId: z.string(),
    result: PageGenerationResultSchema,
  }),
  z.object({
    type: z.literal("error"),
    requestId: z.string(),
    code: z.string(),
    message: z.string(),
  }),
  z.object({
    type: z.literal("complete"),
    requestId: z.string(),
  }),
]);
export type GenerationStreamEvent = z.infer<typeof GenerationStreamEventSchema>;

import { z } from "zod";

export const ConversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  pageId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  messageIds: z.array(z.string()),
});
export type Conversation = z.infer<typeof ConversationSchema>;

export const ChatMessageStatusSchema = z.enum([
  "queued",
  "streaming",
  "complete",
  "failed",
  "canceled",
]);
export type ChatMessageStatus = z.infer<typeof ChatMessageStatusSchema>;

export const ChatContentBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    text: z.string(),
  }),
  z.object({
    type: z.literal("attachment"),
    attachmentId: z.string(),
  }),
  z.object({
    type: z.literal("progress"),
    stage: z.string(),
    detail: z.string().optional(),
  }),
  z.object({
    type: z.literal("edit-proposal"),
    proposalId: z.string(),
    proposalSummary: z.string().optional(),
    status: z.enum(["pending", "applied", "rejected"]).optional(),
  }),
  z.object({
    type: z.literal("generation-result"),
    generationId: z.string(),
    status: z.enum(["ready", "applied", "rejected", "stale"]).optional(),
  }),
  z.object({
    type: z.literal("timeline-event"),
    event: z.enum([
      "manual-edit",
      "website-import",
      "proposal-applied",
      "generation-applied",
      "version-restored",
    ]),
    summary: z.string(),
  }),
  z.object({
    type: z.literal("warning"),
    message: z.string(),
  }),
]);
export type ChatContentBlock = z.infer<typeof ChatContentBlockSchema>;

export const ChatMessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  role: z.enum(["user", "assistant", "timeline"]),
  createdAt: z.string(),
  status: ChatMessageStatusSchema,
  basedOnRevision: z.number().optional(),
  requestId: z.string().optional(),
  blocks: z.array(ChatContentBlockSchema),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatAttachmentReferenceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("import-artifact"),
    capturePackageId: z.string(),
    field: z.string(),
  }),
  z.object({
    type: z.literal("uploaded-artifact"),
    artifactId: z.string(),
  }),
  z.object({
    type: z.literal("document"),
    revision: z.number(),
  }),
]);
export type ChatAttachmentReference = z.infer<typeof ChatAttachmentReferenceSchema>;

export const ChatAttachmentSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  kind: z.enum([
    "screenshot",
    "design-markdown",
    "html-reference",
    "capture-package",
    "asset-reference",
    "current-document",
  ]),
  name: z.string(),
  mimeType: z.string(),
  size: z.number(),
  createdAt: z.string(),
  status: z.enum(["processing", "ready", "failed"]),
  reference: ChatAttachmentReferenceSchema,
});
export type ChatAttachment = z.infer<typeof ChatAttachmentSchema>;

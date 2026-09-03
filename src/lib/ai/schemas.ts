import { z } from "zod";
import { EditorOperationSchema } from "../editor/operation-schema";
import { SerializedNodeSchema } from "../bridge/types";

export const AIEditScopeSchema = z.enum([
  "selected_node",
  "selected_section",
  "document",
]);

export type AIEditScope = z.infer<typeof AIEditScopeSchema>;

export const AncestorSummaryItemSchema = z.object({
  id: z.string(),
  tagName: z.string(),
  label: z.string(),
});

export const DocumentSummarySchema = z.object({
  title: z.string().optional(),
  sectionCount: z.number().optional(),
  outline: z.array(z.string()).optional(),
});

export const AIEditContextSchema = z.object({
  selectedNode: SerializedNodeSchema.optional(),
  selectedSubtreeHtml: z.string().max(8000).optional(),
  ancestorSummary: z.array(AncestorSummaryItemSchema).max(10).optional(),
  nearbyNodes: z.array(SerializedNodeSchema).max(10).optional(),
  designTokens: z.record(z.string(), z.string()).optional(),
  documentSummary: DocumentSummarySchema.optional(),
  isTruncated: z.boolean().optional(),
});

export type AIEditContext = z.infer<typeof AIEditContextSchema>;

export const AIEditRequestSchema = z.object({
  instruction: z.string().min(1).max(1000),
  scope: AIEditScopeSchema,
  selectedNodeId: z.string().nullable(),
  documentRevision: z.number(),
  context: AIEditContextSchema,
});

export type AIEditRequest = z.infer<typeof AIEditRequestSchema>;

export const AIEditProposalSchema = z.object({
  proposalId: z.string(),
  basedOnRevision: z.number(),
  summary: z.string(),
  rationale: z.string().optional(),
  operations: z.array(EditorOperationSchema).max(20),
  warnings: z.array(z.string()),
});

export type AIEditProposal = z.infer<typeof AIEditProposalSchema>;

export const AIProposalRecordSchema = z.object({
  proposalId: z.string(),
  instruction: z.string(),
  status: z.enum(["generated", "applied", "rejected", "stale", "failed"]),
  basedOnRevision: z.number(),
  createdAt: z.string(),
  summary: z.string(),
  operationCount: z.number(),
});

export type AIProposalRecord = z.infer<typeof AIProposalRecordSchema>;

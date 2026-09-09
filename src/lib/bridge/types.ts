import { z } from "zod";
import { EditorOperationSchema } from "../editor/operation-schema";
import { InteractionEventSchema } from "../interaction/schemas";

export const DOMRectDataSchema = z.object({
  top: z.number(),
  left: z.number(),
  width: z.number(),
  height: z.number(),
  bottom: z.number(),
  right: z.number(),
});
export type DOMRectData = z.infer<typeof DOMRectDataSchema>;

export interface SerializedNode {
  id: string; // value of data-editor-id
  tagName: string;
  className: string;
  textContent?: string;
  children: SerializedNode[];
  attributes?: Record<string, string>;
  isComponentOrSection?: boolean;
}

export const SerializedNodeSchema: z.ZodType<SerializedNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    tagName: z.string(),
    className: z.string(),
    textContent: z.string().optional(),
    children: z.array(SerializedNodeSchema),
    attributes: z.record(z.string(), z.string()).optional(),
    isComponentOrSection: z.boolean().optional(),
  })
);

// Iframe -> Parent Messages
export const IframeReadyPayloadSchema = z.object({
  sessionId: z.string(),
  documentTree: SerializedNodeSchema,
  title: z.string().optional(),
  revision: z.number().optional(),
});

export const NodeHoveredPayloadSchema = z.object({
  sessionId: z.string(),
  id: z.string().nullable(),
  rect: DOMRectDataSchema.nullable(),
  tagName: z.string().nullable(),
});

export const NodeSelectedPayloadSchema = z.object({
  sessionId: z.string(),
  id: z.string().nullable(),
  rect: DOMRectDataSchema.nullable(),
  tagName: z.string().nullable(),
  path: z.array(z.string()),
});

export const RectsUpdatedPayloadSchema = z.object({
  sessionId: z.string(),
  selectedId: z.string().nullable(),
  selectedRect: DOMRectDataSchema.nullable(),
  hoveredId: z.string().nullable(),
  hoveredRect: DOMRectDataSchema.nullable(),
});

export const DocumentMutatedPayloadSchema = z.object({
  sessionId: z.string(),
  documentTree: SerializedNodeSchema,
  revision: z.number().optional(),
});

export const InteractionEventPayloadSchema = z.object({
  sessionId: z.string(),
  event: InteractionEventSchema,
});

export const IframeToParentMessageSchema = z.discriminatedUnion("type", [
  z.object({
    source: z.literal("visual-editor-iframe"),
    type: z.literal("IFRAME_READY"),
    payload: IframeReadyPayloadSchema,
  }),
  z.object({
    source: z.literal("visual-editor-iframe"),
    type: z.literal("NODE_HOVERED"),
    payload: NodeHoveredPayloadSchema,
  }),
  z.object({
    source: z.literal("visual-editor-iframe"),
    type: z.literal("NODE_SELECTED"),
    payload: NodeSelectedPayloadSchema,
  }),
  z.object({
    source: z.literal("visual-editor-iframe"),
    type: z.literal("RECTS_UPDATED"),
    payload: RectsUpdatedPayloadSchema,
  }),
  z.object({
    source: z.literal("visual-editor-iframe"),
    type: z.literal("DOCUMENT_MUTATED"),
    payload: DocumentMutatedPayloadSchema,
  }),
  z.object({
    source: z.literal("visual-editor-iframe"),
    type: z.literal("INTERACTION_EVENT"),
    payload: InteractionEventPayloadSchema,
  }),
  z.object({
    source: z.literal("visual-editor-iframe"),
    type: z.literal("HEATMAP_DATA_REPORT"),
    payload: z.lazy(() => HeatmapDataReportPayloadSchema),
  }),
  z.object({
    source: z.literal("visual-editor-iframe"),
    type: z.literal("IFRAME_SCROLLED"),
    payload: z.lazy(() => IframeScrolledPayloadSchema),
  }),
]);
export type IframeToParentMessage = z.infer<typeof IframeToParentMessageSchema>;

export const IframeScrolledPayloadSchema = z.object({
  sessionId: z.string(),
  scrollPercentage: z.number(),
  topVisibleId: z.string().optional(),
});
export type IframeScrolledPayload = z.infer<typeof IframeScrolledPayloadSchema>;

export const SyncScrollToIframePayloadSchema = z.object({
  sessionId: z.string(),
  scrollPercentage: z.number(),
});
export type SyncScrollToIframePayload = z.infer<typeof SyncScrollToIframePayloadSchema>;

export const MeasuredHeatmapNodeSchema = z.object({
  id: z.string(),
  tagName: z.string(),
  rect: DOMRectDataSchema,
  textContent: z.string().optional(),
  isInteractive: z.boolean(),
  classes: z.string().optional(),
  role: z.string().optional(),
});
export type MeasuredHeatmapNode = z.infer<typeof MeasuredHeatmapNodeSchema>;

export const HeatmapDataReportPayloadSchema = z.object({
  sessionId: z.string(),
  nodes: z.array(MeasuredHeatmapNodeSchema),
  scrollHeight: z.number(),
  scrollWidth: z.number(),
  viewportHeight: z.number(),
  viewportWidth: z.number(),
});
export type HeatmapDataReportPayload = z.infer<typeof HeatmapDataReportPayloadSchema>;

export const RequestHeatmapDataPayloadSchema = z.object({
  sessionId: z.string(),
});
export type RequestHeatmapDataPayload = z.infer<typeof RequestHeatmapDataPayloadSchema>;

// Parent -> Iframe Messages
export const SelectNodePayloadSchema = z.object({
  sessionId: z.string(),
  id: z.string().nullable(),
  scrollIntoView: z.boolean().optional(),
});

export const HoverNodePayloadSchema = z.object({
  sessionId: z.string(),
  id: z.string().nullable(),
});

export const ScrollIntoViewPayloadSchema = z.object({
  sessionId: z.string(),
  id: z.string(),
});

export const ApplyOperationPayloadSchema = z.object({
  sessionId: z.string(),
  operation: EditorOperationSchema,
  revision: z.number(),
});

export const SetDocumentSourcePayloadSchema = z.object({
  sessionId: z.string(),
  source: z.string(),
  revision: z.number(),
});

export const HandshakePayloadSchema = z.object({
  sessionId: z.string(),
});

export const SetEditorModePayloadSchema = z.object({
  sessionId: z.string(),
  mode: z.enum(["preview", "design"]),
});

export const ParentToIframeMessageSchema = z.discriminatedUnion("type", [
  z.object({
    source: z.literal("visual-editor-parent"),
    type: z.literal("HANDSHAKE"),
    payload: HandshakePayloadSchema,
  }),
  z.object({
    source: z.literal("visual-editor-parent"),
    type: z.literal("SET_EDITOR_MODE"),
    payload: SetEditorModePayloadSchema,
  }),
  z.object({
    source: z.literal("visual-editor-parent"),
    type: z.literal("SELECT_NODE"),
    payload: SelectNodePayloadSchema,
  }),
  z.object({
    source: z.literal("visual-editor-parent"),
    type: z.literal("HOVER_NODE"),
    payload: HoverNodePayloadSchema,
  }),
  z.object({
    source: z.literal("visual-editor-parent"),
    type: z.literal("SCROLL_INTO_VIEW"),
    payload: ScrollIntoViewPayloadSchema,
  }),
  z.object({
    source: z.literal("visual-editor-parent"),
    type: z.literal("APPLY_OPERATION"),
    payload: ApplyOperationPayloadSchema,
  }),
  z.object({
    source: z.literal("visual-editor-parent"),
    type: z.literal("SET_DOCUMENT_SOURCE"),
    payload: SetDocumentSourcePayloadSchema,
  }),
  z.object({
    source: z.literal("visual-editor-parent"),
    type: z.literal("REQUEST_HEATMAP_DATA"),
    payload: RequestHeatmapDataPayloadSchema,
  }),
  z.object({
    source: z.literal("visual-editor-parent"),
    type: z.literal("SYNC_SCROLL_TO_IFRAME"),
    payload: SyncScrollToIframePayloadSchema,
  }),
]);
export type ParentToIframeMessage = z.infer<typeof ParentToIframeMessageSchema>;

// Helpers for validation with session ID matching
export function parseIframeMessage(
  data: unknown,
  expectedSessionId?: string
): IframeToParentMessage | null {
  const result = IframeToParentMessageSchema.safeParse(data);
  if (!result.success) return null;
  if (expectedSessionId && result.data.payload.sessionId !== expectedSessionId) {
    return null;
  }
  return result.data;
}

export function parseParentMessage(
  data: unknown,
  expectedSessionId?: string
): ParentToIframeMessage | null {
  const result = ParentToIframeMessageSchema.safeParse(data);
  if (!result.success) return null;
  if (expectedSessionId && result.data.payload.sessionId !== expectedSessionId) {
    return null;
  }
  return result.data;
}

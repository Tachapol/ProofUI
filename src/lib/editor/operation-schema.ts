import { z } from "zod";

// Safe attribute regex: alphanumeric, hyphen, underscore, aria-*, data-*
export const SafeAttributeNameSchema = z
  .string()
  .min(1)
  .max(50)
  .refine(
    (name) => {
      const lower = name.toLowerCase();
      // Block event handlers and dangerous attributes
      if (lower.startsWith("on") || lower === "srcdoc") {
        return false;
      }
      return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name);
    },
    { message: "Attribute name contains invalid or unsafe characters" }
  );

// Safe URL validator for href and src
export function isSafeUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  if (
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("vbscript:") ||
    trimmed.startsWith("data:text/html")
  ) {
    return false;
  }
  return true;
}

export const SafeAttributeValueSchema = z
  .string()
  .refine(
    (val) => isSafeUrl(val),
    { message: "Attribute value contains an unsafe URL scheme" }
  );

// Editor Operations Schemas
export const UpdateTextOperationSchema = z.object({
  type: z.literal("update_text"),
  nodeId: z.string().min(1),
  value: z.string(),
});

export const UpdateClassesOperationSchema = z.object({
  type: z.literal("update_classes"),
  nodeId: z.string().min(1),
  add: z.array(z.string()),
  remove: z.array(z.string()),
});

export const SetAttributeOperationSchema = z.object({
  type: z.literal("set_attribute"),
  nodeId: z.string().min(1),
  name: SafeAttributeNameSchema,
  value: SafeAttributeValueSchema,
});

export const RemoveAttributeOperationSchema = z.object({
  type: z.literal("remove_attribute"),
  nodeId: z.string().min(1),
  name: SafeAttributeNameSchema,
});

export const DuplicateNodeOperationSchema = z.object({
  type: z.literal("duplicate_node"),
  nodeId: z.string().min(1),
  newId: z.string().optional(),
});

export const DeleteNodeOperationSchema = z.object({
  type: z.literal("delete_node"),
  nodeId: z.string().min(1),
});

export const EditorOperationSchema = z.discriminatedUnion("type", [
  UpdateTextOperationSchema,
  UpdateClassesOperationSchema,
  SetAttributeOperationSchema,
  RemoveAttributeOperationSchema,
  DuplicateNodeOperationSchema,
  DeleteNodeOperationSchema,
]);

export type EditorOperation = z.infer<typeof EditorOperationSchema>;

export type OperationResult =
  | {
      ok: true;
      source: string;
      affectedNodeIds: string[];
      newSelectedId?: string;
      revision: number;
    }
  | {
      ok: false;
      code: string;
      message: string;
    };

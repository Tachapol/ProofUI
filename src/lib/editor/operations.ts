import { EditorOperation, OperationResult, SafeAttributeNameSchema, isSafeUrl } from "./operation-schema";
import { reassignSubtreeIds } from "../dom/serializer";

export const PROTECTED_TAGS = new Set(["HTML", "HEAD", "BODY", "SCRIPT", "STYLE"]);

/**
 * Parses an HTML string into a DOM Document object.
 * Compatible with both browser and jsdom test environments.
 */
export function parseHtmlDocument(html: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(html, "text/html");
}

/**
 * Serializes a Document back to an HTML string.
 */
export function serializeHtmlDocument(doc: Document): string {
  const html = doc.documentElement.outerHTML;
  return `<!DOCTYPE html>\n${html}`;
}

/**
 * Pure function to execute an EditorOperation against an HTML document string.
 * Returns a typed OperationResult with updated source and metadata, or error details.
 */
export function applyOperationToDocument(
  source: string,
  operation: EditorOperation,
  currentRevision = 0
): OperationResult {
  const doc = parseHtmlDocument(source);
  const targetElement = doc.querySelector(`[data-editor-id="${operation.nodeId}"]`);

  if (!targetElement) {
    return {
      ok: false,
      code: "NODE_NOT_FOUND",
      message: `Node with id "${operation.nodeId}" was not found in document.`,
    };
  }

  const tagUpper = targetElement.tagName.toUpperCase();

  switch (operation.type) {
    case "update_text": {
      if (PROTECTED_TAGS.has(tagUpper)) {
        return {
          ok: false,
          code: "PROTECTED_NODE",
          message: `Cannot update text of protected tag <${tagUpper.toLowerCase()}>.`,
        };
      }

      // Check if element has child elements that would be destroyed
      if (targetElement.children.length > 0) {
        return {
          ok: false,
          code: "UNSAFE_NESTED_TEXT",
          message:
            "Cannot replace text directly because this element contains nested child elements.",
        };
      }

      targetElement.textContent = operation.value;
      return {
        ok: true,
        source: serializeHtmlDocument(doc),
        affectedNodeIds: [operation.nodeId],
        revision: currentRevision + 1,
      };
    }

    case "update_classes": {
      if (PROTECTED_TAGS.has(tagUpper) && tagUpper !== "BODY") {
        return {
          ok: false,
          code: "PROTECTED_NODE",
          message: `Cannot update classes of protected tag <${tagUpper.toLowerCase()}>.`,
        };
      }

      const existingClasses = targetElement.className
        ? targetElement.className.split(/\s+/).filter(Boolean)
        : [];

      const removeSet = new Set(operation.remove);
      const remaining = existingClasses.filter((c) => !removeSet.has(c));

      // Append new classes without duplicates
      for (const toAdd of operation.add) {
        const trimmed = toAdd.trim();
        if (trimmed && !remaining.includes(trimmed)) {
          remaining.push(trimmed);
        }
      }

      targetElement.className = remaining.join(" ");
      return {
        ok: true,
        source: serializeHtmlDocument(doc),
        affectedNodeIds: [operation.nodeId],
        revision: currentRevision + 1,
      };
    }

    case "set_attribute": {
      const nameParsed = SafeAttributeNameSchema.safeParse(operation.name);
      if (!nameParsed.success) {
        return {
          ok: false,
          code: "INVALID_ATTRIBUTE_NAME",
          message: `Attribute name "${operation.name}" is invalid or unsafe.`,
        };
      }

      if (["href", "src"].includes(operation.name.toLowerCase()) && !isSafeUrl(operation.value)) {
        return {
          ok: false,
          code: "UNSAFE_URL",
          message: `URL "${operation.value}" contains an unsafe protocol.`,
        };
      }

      targetElement.setAttribute(operation.name, operation.value);

      // Enforce safe rel when target="_blank"
      if (
        operation.name.toLowerCase() === "target" &&
        operation.value.trim().toLowerCase() === "_blank"
      ) {
        const currentRel = targetElement.getAttribute("rel") || "";
        if (!currentRel.includes("noopener")) {
          targetElement.setAttribute("rel", "noopener noreferrer");
        }
      }

      return {
        ok: true,
        source: serializeHtmlDocument(doc),
        affectedNodeIds: [operation.nodeId],
        revision: currentRevision + 1,
      };
    }

    case "remove_attribute": {
      const nameParsed = SafeAttributeNameSchema.safeParse(operation.name);
      if (!nameParsed.success) {
        return {
          ok: false,
          code: "INVALID_ATTRIBUTE_NAME",
          message: `Attribute name "${operation.name}" is invalid.`,
        };
      }

      targetElement.removeAttribute(operation.name);
      return {
        ok: true,
        source: serializeHtmlDocument(doc),
        affectedNodeIds: [operation.nodeId],
        revision: currentRevision + 1,
      };
    }

    case "duplicate_node": {
      if (PROTECTED_TAGS.has(tagUpper)) {
        return {
          ok: false,
          code: "CANNOT_DUPLICATE_PROTECTED",
          message: `Cannot duplicate <${tagUpper.toLowerCase()}> element.`,
        };
      }

      const clone = targetElement.cloneNode(true) as Element;
      reassignSubtreeIds(clone);
      const newId = operation.newId || clone.getAttribute("data-editor-id") || "";
      clone.setAttribute("data-editor-id", newId);

      targetElement.insertAdjacentElement("afterend", clone);

      return {
        ok: true,
        source: serializeHtmlDocument(doc),
        affectedNodeIds: [operation.nodeId, newId],
        newSelectedId: newId,
        revision: currentRevision + 1,
      };
    }

    case "delete_node": {
      if (PROTECTED_TAGS.has(tagUpper)) {
        return {
          ok: false,
          code: "CANNOT_DELETE_PROTECTED",
          message: `Cannot delete protected <${tagUpper.toLowerCase()}> element.`,
        };
      }

      targetElement.remove();

      return {
        ok: true,
        source: serializeHtmlDocument(doc),
        affectedNodeIds: [operation.nodeId],
        revision: currentRevision + 1,
      };
    }

    default:
      return {
        ok: false,
        code: "UNKNOWN_OPERATION",
        message: "Unrecognized editor operation type.",
      };
  }
}

import { EditorOperation } from "../editor/operation-schema";
import { parseClassList } from "../editor/class-utils";

export interface OperationDescription {
  type: string;
  nodeId: string;
  nodeLabel: string;
  actionText: string;
  details: Array<{
    label: string;
    value: string;
    variant?: "add" | "remove" | "neutral";
  }>;
}

export function describeOperation(
  op: EditorOperation,
  currentDocHtml?: string
): OperationDescription {
  let nodeLabel = `<element>`;
  let existingClasses: string[] = [];
  let existingText = "";

  if (currentDocHtml) {
    try {
      const doc = new DOMParser().parseFromString(currentDocHtml, "text/html");
      const el = doc.querySelector(`[data-editor-id="${op.nodeId}"]`);
      if (el) {
        nodeLabel = `<${el.tagName.toLowerCase()}>`;
        existingClasses = parseClassList(el.className);
        existingText = (el.textContent || "").trim();
      }
    } catch {
      // Fallback
    }
  }

  switch (op.type) {
    case "update_classes": {
      const details: OperationDescription["details"] = [];
      if (op.remove && op.remove.length > 0) {
        details.push({
          label: "Remove",
          value: op.remove.join(" "),
          variant: "remove",
        });
      }
      if (op.add && op.add.length > 0) {
        details.push({
          label: "Add",
          value: op.add.join(" "),
          variant: "add",
        });
      }
      const preserved = existingClasses.filter(
        (c) => !op.remove?.includes(c) && !op.add?.includes(c)
      );
      if (preserved.length > 0) {
        details.push({
          label: "Preserved",
          value: preserved.slice(0, 4).join(" ") + (preserved.length > 4 ? ` (+${preserved.length - 4} more)` : ""),
          variant: "neutral",
        });
      }
      return {
        type: "update_classes",
        nodeId: op.nodeId,
        nodeLabel,
        actionText: `Update classes on ${nodeLabel}`,
        details,
      };
    }

    case "update_text": {
      return {
        type: "update_text",
        nodeId: op.nodeId,
        nodeLabel,
        actionText: `Update text on ${nodeLabel}`,
        details: [
          { label: "Before", value: existingText ? `"${existingText.slice(0, 35)}"` : "(empty)", variant: "remove" },
          { label: "After", value: `"${op.value.slice(0, 35)}"`, variant: "add" },
        ],
      };
    }

    case "set_attribute": {
      return {
        type: "set_attribute",
        nodeId: op.nodeId,
        nodeLabel,
        actionText: `Set attribute "${op.name}" on ${nodeLabel}`,
        details: [
          { label: "Attribute", value: op.name, variant: "neutral" },
          { label: "Value", value: op.value, variant: "add" },
        ],
      };
    }

    case "remove_attribute": {
      return {
        type: "remove_attribute",
        nodeId: op.nodeId,
        nodeLabel,
        actionText: `Remove attribute "${op.name}" on ${nodeLabel}`,
        details: [
          { label: "Removed Attribute", value: op.name, variant: "remove" },
        ],
      };
    }

    case "duplicate_node": {
      return {
        type: "duplicate_node",
        nodeId: op.nodeId,
        nodeLabel,
        actionText: `Duplicate ${nodeLabel}`,
        details: [
          { label: "Target", value: `Clones subtree immediately after itself with fresh IDs`, variant: "add" },
        ],
      };
    }

    case "delete_node": {
      return {
        type: "delete_node",
        nodeId: op.nodeId,
        nodeLabel,
        actionText: `Delete ${nodeLabel}`,
        details: [
          { label: "Target", value: `Removes element and all its children`, variant: "remove" },
        ],
      };
    }
  }
}

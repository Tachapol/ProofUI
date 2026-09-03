import { AIEditProvider } from "./provider";
import { AIEditRequest, AIEditProposal } from "./schemas";
import { EditorOperation } from "../editor/operation-schema";
import { parseClassList, resolveClassChange } from "../editor/class-utils";

export class MockAIEditProvider implements AIEditProvider {
  async generateEdit(
    request: AIEditRequest,
    options?: { signal?: AbortSignal }
  ): Promise<AIEditProposal> {
    if (options?.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const instruction = request.instruction.trim().toLowerCase();
    const targetId = request.selectedNodeId || request.context.selectedNode?.id || "hero-title";
    const targetClasses = parseClassList(request.context.selectedNode?.className || "");
    const operations: EditorOperation[] = [];
    const warnings: string[] = [];
    let summary = "";
    let rationale = "";

    // Instruction 1: "make the hero headline larger" / "make headline larger" / "increase font size"
    if (
      instruction.includes("headline") ||
      instruction.includes("larger") ||
      instruction.includes("bigger") ||
      instruction.includes("font size")
    ) {
      const { add, remove } = resolveClassChange(targetClasses, "text-6xl", "textSize");
      operations.push({
        type: "update_classes",
        nodeId: targetId,
        add,
        remove,
      });
      summary = `Increase text size of heading to text-6xl`;
      rationale =
        "Upgraded base font size utility from text-4xl to text-6xl for enhanced visual hierarchy, while strictly preserving responsive prefixes and tracking classes.";
    }
    // Instruction 2: "center this content" / "align center"
    else if (instruction.includes("center") || instruction.includes("align")) {
      const { add, remove } = resolveClassChange(targetClasses, "text-center", "textAlign");
      operations.push({
        type: "update_classes",
        nodeId: targetId,
        add,
        remove,
      });
      summary = "Center text alignment";
      rationale = "Applied text-center utility and removed conflicting text-left alignment.";
    }
    // Instruction 3: "change this button text to start free" / "button text"
    else if (
      instruction.includes("start free") ||
      instruction.includes("button text") ||
      instruction.includes("cta")
    ) {
      operations.push({
        type: "update_text",
        nodeId: targetId,
        value: "Start free",
      });
      summary = 'Update button text to "Start free"';
      rationale = "Updated CTA text to direct, conversion-focused copy.";
    }
    // Instruction 4: "duplicate this card" / "duplicate"
    else if (
      instruction.includes("duplicate") ||
      instruction.includes("clone") ||
      instruction.includes("copy card")
    ) {
      operations.push({
        type: "duplicate_node",
        nodeId: targetId,
      });
      summary = "Duplicate component card";
      rationale = "Created an immediate duplicate of the selected element with new stable IDs.";
    }
    // Instruction 5: "make this section more spacious" / "spacious" / "increase padding"
    else if (
      instruction.includes("spacious") ||
      instruction.includes("padding") ||
      instruction.includes("spacing")
    ) {
      const { add, remove } = resolveClassChange(targetClasses, "p-12", "paddingAll");
      operations.push({
        type: "update_classes",
        nodeId: targetId,
        add,
        remove,
      });
      summary = "Increase section spacing";
      rationale = "Increased container padding to p-12 for a more breathable, modern layout.";
    }
    // Unknown instructions: return safe no-op proposal
    else {
      summary = "No applicable structured changes";
      warnings.push(
        `Could not match instruction "${request.instruction}" to a deterministic structured edit. Try: "Make the hero headline larger", "Center this content", "Change this button text to Start free", or "Duplicate this card".`
      );
    }

    return {
      proposalId: `prop_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      basedOnRevision: request.documentRevision,
      summary,
      rationale,
      operations,
      warnings,
    };
  }
}

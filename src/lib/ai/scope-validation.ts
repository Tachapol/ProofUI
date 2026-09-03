import { AIEditProposal, AIEditScope } from "./schemas";
import { SerializedNode } from "../bridge/types";

interface ScopeValidationOptions {
  proposal: AIEditProposal;
  scope: AIEditScope;
  instruction: string;
  selectedNodeId: string | null;
  documentTree: SerializedNode | null;
}

// Collect all node IDs present within a subtree
function collectSubtreeIds(node: SerializedNode, idSet: Set<string>) {
  idSet.add(node.id);
  if (node.children) {
    for (const child of node.children) {
      collectSubtreeIds(child, idSet);
    }
  }
}

// Find a node by ID in tree
function findNode(root: SerializedNode, targetId: string): SerializedNode | null {
  if (root.id === targetId) return root;
  if (root.children) {
    for (const child of root.children) {
      const found = findNode(child, targetId);
      if (found) return found;
    }
  }
  return null;
}

export function validateProposalScope(options: ScopeValidationOptions): {
  isValid: boolean;
  errors: string[];
} {
  const { proposal, scope, instruction, selectedNodeId, documentTree } = options;
  const errors: string[] = [];
  const lowerInstruction = instruction.toLowerCase();

  // Rule 1: Check delete and duplicate explicit permission
  for (const op of proposal.operations) {
    if (op.type === "delete_node") {
      const hasPermission =
        lowerInstruction.includes("delete") ||
        lowerInstruction.includes("remove") ||
        lowerInstruction.includes("trash");
      if (!hasPermission) {
        errors.push(
          `Operation delete_node on ${op.nodeId} rejected: user instruction does not explicitly authorize deletion.`
        );
      }
    }

    if (op.type === "duplicate_node") {
      const hasPermission =
        lowerInstruction.includes("duplicate") ||
        lowerInstruction.includes("clone") ||
        lowerInstruction.includes("copy");
      if (!hasPermission) {
        errors.push(
          `Operation duplicate_node on ${op.nodeId} rejected: user instruction does not explicitly authorize duplication.`
        );
      }
    }
  }

  // Rule 2: Scope boundaries
  if (scope === "selected_node" && selectedNodeId && documentTree) {
    const targetSubtree = findNode(documentTree, selectedNodeId);
    const allowedIds = new Set<string>();
    if (targetSubtree) {
      collectSubtreeIds(targetSubtree, allowedIds);
    } else {
      allowedIds.add(selectedNodeId);
    }

    for (const op of proposal.operations) {
      if (!allowedIds.has(op.nodeId)) {
        errors.push(
          `Operation on "${op.nodeId}" escapes the requested scope "selected_node" (${selectedNodeId}).`
        );
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

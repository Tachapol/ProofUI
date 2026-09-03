import { AIEditProposal } from "./schemas";
import { applyOperationToDocument } from "../editor/operations";
import { validateHtmlSource } from "../code/code-validation";

export interface SimulationResult {
  canApply: boolean;
  predictedSource: string;
  affectedNodeIds: string[];
  errors: string[];
  warnings: string[];
}

export function simulateProposal(
  proposal: AIEditProposal,
  currentSource: string,
  currentRevision: number
): SimulationResult {
  const errors: string[] = [];
  const warnings: string[] = [...proposal.warnings];
  const affectedNodeIds: string[] = [];

  // Check 1: Revision freshness
  if (proposal.basedOnRevision < currentRevision) {
    errors.push(
      `Proposal is based on revision ${proposal.basedOnRevision}, but the document is currently on revision ${currentRevision}. Please regenerate proposal.`
    );
    return {
      canApply: false,
      predictedSource: currentSource,
      affectedNodeIds: [],
      errors,
      warnings,
    };
  }

  // Check 2: Sequential operation application on decoupled HTML
  let workingSource = currentSource;
  let simulatedRev = currentRevision;

  for (let i = 0; i < proposal.operations.length; i++) {
    const op = proposal.operations[i];
    const opResult = applyOperationToDocument(workingSource, op, simulatedRev);

    if (!opResult.ok) {
      errors.push(
        `Operation ${i + 1} (${op.type}) failed: ${opResult.message} (code: ${opResult.code})`
      );
      break;
    }

    workingSource = opResult.source;
    simulatedRev = opResult.revision;
    affectedNodeIds.push(...opResult.affectedNodeIds);
  }

  if (errors.length > 0) {
    return {
      canApply: false,
      predictedSource: currentSource,
      affectedNodeIds: [],
      errors,
      warnings,
    };
  }

  // Check 3: Validate the resulting simulated HTML
  const validation = validateHtmlSource(workingSource);
  if (!validation.isValid) {
    const errorMessages = validation.diagnostics
      .filter((d) => d.severity === "error")
      .map((d) => d.message);
    errors.push(...errorMessages);
  }

  return {
    canApply: errors.length === 0,
    predictedSource: workingSource,
    affectedNodeIds: Array.from(new Set(affectedNodeIds)),
    errors,
    warnings,
  };
}

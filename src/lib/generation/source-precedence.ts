import {
  PageGenerationRequest,
  SourcePrecedenceReport,
} from "./schemas";

export interface NormalizedGenerationContext {
  cleanInstruction: string;
  sourcePrecedence: SourcePrecedenceReport;
  visualReference?: string;
  structuralReference?: PageGenerationRequest["context"]["capturedStructure"];
  designTokensReference?: PageGenerationRequest["context"]["designTokens"];
  assetsReference?: PageGenerationRequest["context"]["assets"];
  designMarkdownReference?: string;
  currentDocumentHtml?: string;
}

// Strip malicious instructions attempting prompt injection from reference text
export function sanitizeReferenceContent(rawText: string): string {
  if (!rawText) return "";

  return rawText
    .replace(/\b(ignore\s+(all\s+)?previous\s+instructions?)\b/gi, "[REDACTED_INSTRUCTION]")
    .replace(/\b(you\s+are\s+now\s+(a|an)?)\b/gi, "[REDACTED_ROLE_PROMPT]")
    .replace(/\b(system\s+prompt:?)\b/gi, "[REDACTED_PROMPT_PREFIX]")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "");
}

// Deduplicate repeated prompt instructions
export function normalizeUserInstruction(instruction: string): string {
  if (!instruction) return "";

  const lines = instruction.split("\n").map((l) => l.trim()).filter(Boolean);
  const seen = new Set<string>();
  const uniqueLines: string[] = [];

  for (const line of lines) {
    const normalized = line.toLowerCase();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      uniqueLines.push(line);
    }
  }

  return uniqueLines.join("\n").trim();
}

export function buildNormalizedContext(
  request: PageGenerationRequest
): NormalizedGenerationContext {
  const cleanInstruction = normalizeUserInstruction(request.instruction);

  const sources: SourcePrecedenceReport["sources"] = [
    { sourceId: "user-instruction", role: "user-goal" },
  ];
  const conflicts: SourcePrecedenceReport["conflicts"] = [];

  if (request.context.screenshotReference) {
    sources.push({
      sourceId: "capture-screenshot",
      role: "primary-visual",
    });
  }

  if (request.context.capturedStructure) {
    sources.push({
      sourceId: "captured-dom-structure",
      role: "primary-structure",
    });
  }

  if (request.context.designTokens || request.context.designMarkdown) {
    sources.push({
      sourceId: "design-system-tokens",
      role: "secondary-design-system",
    });
  }

  if (request.context.currentDocument?.html) {
    sources.push({
      sourceId: "current-editor-document",
      role: "current-document",
    });
  }

  // Record standard precedence policy
  if (request.context.screenshotReference && request.context.capturedStructure) {
    conflicts.push({
      category: "layout_composition",
      winningSourceId: "capture-screenshot",
      ignoredSourceIds: ["captured-dom-structure"],
      explanation:
        "Visual screenshot takes precedence for visible layout geometry, positioning, and whitespace rhythm.",
    });
  }

  if (request.context.capturedStructure && request.context.designMarkdown) {
    conflicts.push({
      category: "semantic_hierarchy",
      winningSourceId: "captured-dom-structure",
      ignoredSourceIds: ["design-system-tokens"],
      explanation:
        "Extracted DOM structure takes precedence for semantic tags and heading hierarchy over generic markdown notes.",
    });
  }

  const sourcePrecedence: SourcePrecedenceReport = {
    sources,
    conflicts,
  };

  return {
    cleanInstruction,
    sourcePrecedence,
    visualReference: request.context.screenshotReference,
    structuralReference: request.context.capturedStructure,
    designTokensReference: request.context.designTokens,
    assetsReference: request.context.assets,
    designMarkdownReference: request.context.designMarkdown
      ? sanitizeReferenceContent(request.context.designMarkdown)
      : undefined,
    currentDocumentHtml: request.context.currentDocument?.html
      ? sanitizeReferenceContent(request.context.currentDocument.html)
      : undefined,
  };
}

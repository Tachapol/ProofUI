import { ExtractedStructure, ExtractedNode, ComponentSignal } from "./schemas";
import { EvidenceTracker } from "./evidence";

export function inferComponentSignals(
  structure: ExtractedStructure,
  tracker: EvidenceTracker
): ComponentSignal[] {
  const signals: ComponentSignal[] = [];

  function evaluateNode(node: ExtractedNode) {
    const tag = node.tagName.toLowerCase();
    const className = (node.attributes.class || "").toLowerCase();
    const role = (node.role || "").toLowerCase();
    const text = (node.textPreview || "").toLowerCase();

    // 1. Header / Navigation
    if (tag === "header" || role === "banner" || className.includes("header") || className.includes("navbar")) {
      signals.push({
        kind: "Header",
        captureNodeId: node.captureId,
        confidence: tag === "header" || role === "banner" ? 0.95 : 0.75,
        evidence: [
          tag === "header" ? "Semantic <header> HTML tag" : `Class/role indicator: "${className || role}"`,
        ],
      });
    }

    if (tag === "nav" || role === "navigation" || className.includes("nav")) {
      signals.push({
        kind: "Navigation",
        captureNodeId: node.captureId,
        confidence: tag === "nav" || role === "navigation" ? 0.95 : 0.75,
        evidence: [
          tag === "nav" ? "Semantic <nav> element" : `Navigation role or class indicator`,
        ],
      });
    }

    // 2. Hero Section
    if (
      className.includes("hero") ||
      node.attributes.id?.toLowerCase().includes("hero") ||
      (tag === "section" && node.children.some((c) => c.tagName === "h1"))
    ) {
      signals.push({
        kind: "Hero",
        captureNodeId: node.captureId,
        confidence: 0.88,
        evidence: [
          className.includes("hero")
            ? 'Class name contains "hero"'
            : "Top-level section containing primary <h1> element",
        ],
      });
    }

    // 3. Card Group / Feature Grid
    if (
      className.includes("grid") ||
      className.includes("cards") ||
      className.includes("features") ||
      (node.children.length >= 2 && node.children.every((c) => (c.attributes.class || "").includes("card")))
    ) {
      signals.push({
        kind: "Feature Grid",
        captureNodeId: node.captureId,
        confidence: 0.82,
        evidence: [
          `Multi-child container with ${node.children.length} structured card elements`,
        ],
      });
    }

    // 4. Pricing / FAQ / Testimonials
    if (className.includes("pricing") || text.includes("pricing") || text.includes("per month") || text.includes("/mo")) {
      signals.push({
        kind: "Pricing Section",
        captureNodeId: node.captureId,
        confidence: 0.85,
        evidence: ["Pricing keywords or plan structures detected"],
      });
    }

    if (className.includes("faq") || text.includes("frequently asked")) {
      signals.push({
        kind: "FAQ",
        captureNodeId: node.captureId,
        confidence: 0.85,
        evidence: ['FAQ keyword pattern and question/answer layout detected'],
      });
    }

    // 5. CTA (Call To Action)
    if (
      (tag === "button" || tag === "a") &&
      (text.includes("get started") || text.includes("sign up") || text.includes("try free") || text.includes("start free"))
    ) {
      signals.push({
        kind: "Call To Action",
        captureNodeId: node.captureId,
        confidence: 0.90,
        evidence: [`Prominent action link or button with text: "${node.textPreview}"`],
      });
    }

    // 6. Footer
    if (tag === "footer" || role === "contentinfo" || className.includes("footer")) {
      signals.push({
        kind: "Footer",
        captureNodeId: node.captureId,
        confidence: tag === "footer" ? 0.98 : 0.80,
        evidence: [tag === "footer" ? "Semantic <footer> element" : 'Footer class/role'],
      });
    }

    for (const child of node.children) {
      evaluateNode(child);
    }
  }

  evaluateNode(structure.root);

  // Record evidence
  for (const sig of signals) {
    tracker.add({
      category: "structure",
      source: "heuristic",
      nodeIds: [sig.captureNodeId],
      description: `Inferred component [${sig.kind}] with ${(sig.confidence * 100).toFixed(0)}% confidence: ${sig.evidence.join("; ")}`,
      confidence: sig.confidence,
    });
  }

  return signals;
}

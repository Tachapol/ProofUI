import { AccessibilitySignal, ExtractedStructure } from "./schemas";
import { EvidenceTracker } from "./evidence";

export function evaluateAccessibilityObservations(
  structure: ExtractedStructure,
  tracker: EvidenceTracker
): AccessibilitySignal[] {
  const observations: AccessibilitySignal[] = [];

  // 1. Heading Hierarchy Evaluation
  const headings = structure.headings;
  if (headings.length === 0) {
    observations.push({
      observation: "No heading elements (H1..H6) found in document.",
      type: "warning",
      confidence: 0.95,
      evidence: ["DOM scan found 0 heading tags"],
    });
  } else {
    const h1Count = headings.filter((h) => h.level === 1).length;
    if (h1Count === 1) {
      observations.push({
        observation: "Document has exactly one primary <h1> element.",
        type: "positive",
        confidence: 0.98,
        evidence: [`Single H1 found with title "${headings.find((h) => h.level === 1)?.text || ""}"`],
      });
    } else if (h1Count > 1) {
      observations.push({
        observation: `Document contains ${h1Count} separate <h1> headings. A single primary <h1> is recommended for clear document structure.`,
        type: "warning",
        confidence: 0.95,
        evidence: [`Observed ${h1Count} H1 tags`],
      });
    }

    // Check for level jumps (e.g. h1 to h3 without h2)
    let hasSkippedLevel = false;
    for (let i = 1; i < headings.length; i++) {
      if (headings[i].level > headings[i - 1].level + 1) {
        hasSkippedLevel = true;
        break;
      }
    }
    if (hasSkippedLevel) {
      observations.push({
        observation: "Heading hierarchy skips levels (e.g. H1 directly to H3 without intermediate H2).",
        type: "warning",
        confidence: 0.92,
        evidence: ["Heading progression analysis"],
      });
    }
  }

  // 2. Landmarks Check
  const landmarks = structure.landmarks;
  const hasMain = landmarks.some((l) => l.tag === "main" || l.role === "main");
  const hasNav = landmarks.some((l) => l.tag === "nav" || l.role === "navigation");

  if (hasMain) {
    observations.push({
      observation: "Semantic <main> landmark identified for primary content.",
      type: "positive",
      confidence: 0.98,
      evidence: ["<main> tag or role='main' detected"],
    });
  } else {
    observations.push({
      observation: "No <main> landmark element identified for primary content.",
      type: "warning",
      confidence: 0.95,
      evidence: ["Missing <main> tag"],
    });
  }

  if (hasNav) {
    observations.push({
      observation: "Semantic <nav> navigation landmark present.",
      type: "positive",
      confidence: 0.98,
      evidence: ["<nav> tag or role='navigation' detected"],
    });
  }

  // Record into evidence tracker
  for (const obs of observations) {
    tracker.add({
      category: "accessibility",
      source: "heuristic",
      description: `Accessibility observation: ${obs.observation}`,
      confidence: obs.confidence,
    });
  }

  return observations;
}

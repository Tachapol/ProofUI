import { generateNodeId } from "../dom/serializer";
import { serializeHtmlDocument } from "../editor/operations";

export interface NodeMatch {
  previousNodeId: string;
  candidatePath: string;
  confidence: number;
  reasons: string[];
}

export interface ReconciliationResult {
  reconciledHtml: string;
  assignedCount: number;
  preservedCount: number;
  regeneratedCount: number;
  warnings: string[];
  matches?: NodeMatch[];
}

export interface ReconciliationOptions {
  confidenceThreshold?: number; // default 0.70
}

interface NodeFingerprint {
  id: string;
  tagName: string;
  parentTagName: string | null;
  htmlId: string | null;
  href: string | null;
  role: string | null;
  textSnippet: string;
  path: string;
}

function getElementPath(el: Element): string {
  const parts: string[] = [];
  let curr: Element | null = el;
  while (curr && curr.tagName.toLowerCase() !== "html") {
    let index = 0;
    let sibling = curr.previousElementSibling;
    while (sibling) {
      if (sibling.tagName === curr.tagName) index++;
      sibling = sibling.previousElementSibling;
    }
    const tag = curr.tagName.toLowerCase();
    parts.unshift(`${tag}[${index}]`);
    curr = curr.parentElement;
  }
  return parts.join(" > ");
}

function extractFingerprints(root: Element): NodeFingerprint[] {
  const prints: NodeFingerprint[] = [];

  function traverse(el: Element) {
    const editorId = el.getAttribute("data-editor-id");
    if (editorId) {
      prints.push({
        id: editorId,
        tagName: el.tagName.toLowerCase(),
        parentTagName: el.parentElement ? el.parentElement.tagName.toLowerCase() : null,
        htmlId: el.getAttribute("id"),
        href: el.getAttribute("href"),
        role: el.getAttribute("role"),
        textSnippet: (el.textContent || "").trim().slice(0, 40),
        path: getElementPath(el),
      });
    }

    for (let i = 0; i < el.children.length; i++) {
      traverse(el.children[i]);
    }
  }

  traverse(root);
  return prints;
}

export function reconcileEditorIds(
  oldHtml: string,
  newHtml: string,
  options: ReconciliationOptions = {}
): ReconciliationResult {
  const confidenceThreshold = options.confidenceThreshold ?? 0.70;

  const parser = new DOMParser();
  const oldDoc = parser.parseFromString(oldHtml, "text/html");
  const newDoc = parser.parseFromString(newHtml, "text/html");

  const warnings: string[] = [];
  const matches: NodeMatch[] = [];
  let assignedCount = 0;
  let preservedCount = 0;
  let regeneratedCount = 0;

  // 1. Extract existing fingerprints from old document
  const oldFingerprints = oldDoc.body ? extractFingerprints(oldDoc.body) : [];
  const usedOldIds = new Set<string>();

  // 2. Scan new document for existing data-editor-id attributes
  const existingNewIds = new Set<string>();
  const duplicateNewElements: Element[] = [];

  if (!newDoc.body) {
    return {
      reconciledHtml: newHtml,
      assignedCount: 0,
      preservedCount: 0,
      regeneratedCount: 0,
      warnings: ["No body element found in new document."],
      matches: [],
    };
  }

  const allNewElements = Array.from(newDoc.body.querySelectorAll("*"));
  allNewElements.unshift(newDoc.body);

  for (const el of allNewElements) {
    const id = el.getAttribute("data-editor-id");
    if (id) {
      if (existingNewIds.has(id)) {
        duplicateNewElements.push(el);
      } else {
        existingNewIds.add(id);
        usedOldIds.add(id);
        preservedCount++;
      }
    }
  }

  // Deduplicate any duplicates by reassigning fresh IDs
  for (const dupEl of duplicateNewElements) {
    const freshId = generateNodeId();
    dupEl.setAttribute("data-editor-id", freshId);
    regeneratedCount++;
    warnings.push(`Reassigned duplicate ID to fresh ID: ${freshId}`);
  }

  // 3. For elements missing data-editor-id, evaluate candidates with explicit confidence
  const availableOldPrints = oldFingerprints.filter((fp) => !usedOldIds.has(fp.id));

  for (const el of allNewElements) {
    if (el.getAttribute("data-editor-id")) {
      continue;
    }

    const tagName = el.tagName.toLowerCase();
    const htmlId = el.getAttribute("id");
    const href = el.getAttribute("href");
    const role = el.getAttribute("role");
    const textSnippet = (el.textContent || "").trim().slice(0, 40);
    const candidatePath = getElementPath(el);
    const parentTag = el.parentElement ? el.parentElement.tagName.toLowerCase() : null;

    // Score all available fingerprints matching the same tag name
    const candidateScores: Array<{
      fp: NodeFingerprint;
      confidence: number;
      reasons: string[];
    }> = [];

    for (const fp of availableOldPrints) {
      if (fp.tagName !== tagName) continue;

      let score = 0;
      const reasons: string[] = [];

      // Strong Signal 1: HTML ID match (#id)
      if (htmlId && fp.htmlId && htmlId === fp.htmlId) {
        score = Math.max(score, 0.95);
        reasons.push("Matching HTML ID attribute");
      }

      // Strong Signal 2: Identical href on link
      if (href && fp.href && href === fp.href) {
        score = Math.max(score, 0.88);
        reasons.push("Matching href on link");
      }

      // Strong Signal 3: Matching role and text snippet
      if (role && fp.role && role === fp.role && textSnippet && fp.textSnippet === textSnippet) {
        score = Math.max(score, 0.82);
        reasons.push("Matching role and text snippet");
      }

      // Signal 4: Unique non-empty text snippet + matching parent tag
      if (textSnippet && fp.textSnippet === textSnippet && parentTag === fp.parentTagName) {
        // Check if this text snippet appears multiple times in available prints (ambiguous check)
        const duplicateTextCount = availableOldPrints.filter(
          (other) => other.tagName === tagName && other.textSnippet === textSnippet
        ).length;

        if (duplicateTextCount === 1) {
          score = Math.max(score, 0.78);
          reasons.push("Unique text snippet with matching parent tag");
        } else {
          // Ambiguous repeated text block (e.g. repeated "Learn more" or identical card copy)
          score = Math.max(score, 0.40);
          reasons.push("Repeated identical text snippet (ambiguous)");
        }
      }

      // Signal 5: Matching tree path
      if (candidatePath === fp.path && parentTag === fp.parentTagName) {
        score = Math.max(score, 0.60);
        reasons.push("Matching DOM hierarchy path");
      }

      if (score > 0) {
        candidateScores.push({ fp, confidence: score, reasons });
      }
    }

    // Sort by confidence descending
    candidateScores.sort((a, b) => b.confidence - a.confidence);

    // Evaluate top match
    const topCandidate = candidateScores[0];
    const secondCandidate = candidateScores[1];

    // Check for ambiguity: if multiple candidates share the exact same top score, don't force a match
    const isAmbiguous =
      topCandidate &&
      secondCandidate &&
      Math.abs(topCandidate.confidence - secondCandidate.confidence) < 0.05;

    if (topCandidate && topCandidate.confidence >= confidenceThreshold && !isAmbiguous) {
      // Confident, unambiguous match: preserve ID
      const matchedFp = topCandidate.fp;
      el.setAttribute("data-editor-id", matchedFp.id);
      usedOldIds.add(matchedFp.id);

      matches.push({
        previousNodeId: matchedFp.id,
        candidatePath,
        confidence: topCandidate.confidence,
        reasons: topCandidate.reasons,
      });

      const index = availableOldPrints.indexOf(matchedFp);
      if (index !== -1) availableOldPrints.splice(index, 1);
      preservedCount++;
    } else {
      // Below threshold or ambiguous match: assign fresh ID (prefer fresh over wrong)
      const newId = generateNodeId();
      el.setAttribute("data-editor-id", newId);
      assignedCount++;

      if (isAmbiguous) {
        warnings.push(
          `Ambiguous match detected for <${tagName}> at ${candidatePath}. Assigned fresh ID: ${newId}`
        );
      }
    }
  }

  if (regeneratedCount > 5) {
    warnings.push(
      `Notice: ${regeneratedCount} nodes required new identity regeneration due to duplicate or missing IDs.`
    );
  }

  return {
    reconciledHtml: serializeHtmlDocument(newDoc),
    assignedCount,
    preservedCount,
    regeneratedCount,
    warnings,
    matches,
  };
}

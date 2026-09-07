import * as parse5 from "parse5";
import {
  UXAnalysisResult,
  UXAnalysisViewport,
  UXFinding,
  UXCategory,
  UXSeverity,
} from "./schemas";

type Parse5Node = {
  nodeName: string;
  tagName?: string;
  value?: string;
  attrs?: Array<{ name: string; value: string }>;
  childNodes?: Parse5Node[];
};

interface DOMElementInfo {
  node: Parse5Node;
  tagName: string;
  editorId: string | null;
  classes: string[];
  classList: Set<string>;
  style: string;
  attrs: Map<string, string>;
  textContent: string;
}

function getAttribute(node: Parse5Node, name: string): string | null {
  if (!node.attrs) return null;
  const match = node.attrs.find(
    (a) => a.name.toLowerCase() === name.toLowerCase()
  );
  return match ? match.value : null;
}

function hasAttribute(node: Parse5Node, name: string): boolean {
  if (!node.attrs) return false;
  return node.attrs.some((a) => a.name.toLowerCase() === name.toLowerCase());
}

function getTextContent(node: Parse5Node): string {
  if (!node) return "";
  if (node.nodeName === "#text") return node.value || "";
  if (node.childNodes) {
    return node.childNodes.map(getTextContent).join("");
  }
  return "";
}

function parseElementInfo(node: Parse5Node): DOMElementInfo {
  const tagName = (node.tagName || node.nodeName || "").toLowerCase();
  const editorId = getAttribute(node, "data-editor-id");
  const classAttr = getAttribute(node, "class") || "";
  const classes = classAttr.split(/\s+/).filter(Boolean);
  const classList = new Set(classes);
  const style = getAttribute(node, "style") || "";

  const attrs = new Map<string, string>();
  if (node.attrs) {
    for (const a of node.attrs) {
      attrs.set(a.name.toLowerCase(), a.value);
    }
  }

  const textContent = getTextContent(node).trim();

  return {
    node,
    tagName,
    editorId,
    classes,
    classList,
    style,
    attrs,
    textContent,
  };
}

function collectElements(
  node: Parse5Node,
  results: DOMElementInfo[] = []
): DOMElementInfo[] {
  if (!node) return results;

  if (node.tagName || (node.nodeName && !node.nodeName.startsWith("#"))) {
    results.push(parseElementInfo(node));
  }

  if (node.childNodes) {
    for (const child of node.childNodes) {
      collectElements(child, results);
    }
  }
  return results;
}

/**
 * Checks if a button or link has an accessible name.
 */
function hasAccessibleName(el: DOMElementInfo): boolean {
  // 1. aria-label or aria-labelledby
  const ariaLabel = el.attrs.get("aria-label");
  if (ariaLabel && ariaLabel.trim().length > 0) return true;

  const ariaLabelledby = el.attrs.get("aria-labelledby");
  if (ariaLabelledby && ariaLabelledby.trim().length > 0) return true;

  // 2. Direct text content
  if (el.textContent.length > 0) return true;

  // 3. title attribute
  const title = el.attrs.get("title");
  if (title && title.trim().length > 0) return true;

  // 4. Check children for img with alt or svg with title / aria-label
  if (el.node.childNodes) {
    const childElements = collectElements(el.node, []).slice(1);
    for (const child of childElements) {
      if (child.tagName === "img") {
        const alt = child.attrs.get("alt");
        if (alt && alt.trim().length > 0) return true;
      }
      if (child.tagName === "svg") {
        const svgAria = child.attrs.get("aria-label");
        if (svgAria && svgAria.trim().length > 0) return true;
        if (child.textContent.length > 0) return true;
      }
    }
  }

  return false;
}

export interface AnalyzeUXOptions {
  viewport?: UXAnalysisViewport;
  revision?: number;
}

/**
 * Deterministically analyzes HTML and computes findings across:
 * 1. images without alt
 * 2. buttons/links without accessible names
 * 3. missing / multiple h1
 * 4. skipped heading levels
 * 5. missing <main>
 * 6. mobile overflow at 390px
 * 7. likely touch targets below 44x44 px
 * 8. no visible CTA heuristic
 */
export function analyzeDocumentUX(
  html: string,
  options: AnalyzeUXOptions = {}
): UXAnalysisResult {
  const viewport: UXAnalysisViewport = options.viewport || "desktop";
  const revision = options.revision ?? 1;

  const parsed = parse5.parse(html) as Parse5Node;
  const elements = collectElements(parsed);

  const findings: UXFinding[] = [];
  let findingIndex = 1;

  const addFinding = (
    category: UXCategory,
    severity: UXSeverity,
    title: string,
    recommendation: string,
    confidence: number,
    affectedNodeIds: string[],
    evidence: string
  ) => {
    findings.push({
      id: `finding-${findingIndex++}`,
      severity,
      category,
      title,
      recommendation,
      confidence,
      affectedNodeIds,
      evidence,
    });
  };

  // -------------------------------------------------------------
  // Check 1: Images without alt
  // -------------------------------------------------------------
  const imageElements = elements.filter((el) => el.tagName === "img");
  for (const img of imageElements) {
    if (!hasAttribute(img.node, "alt")) {
      const src = img.attrs.get("src") || "unknown";
      addFinding(
        "accessibility",
        "warning",
        "Image missing alt attribute",
        "Provide a descriptive alt attribute, or alt=\"\" if the image is decorative.",
        1.0,
        img.editorId ? [img.editorId] : [],
        `<img src="${src}"> is missing an alt attribute.`
      );
    }
  }

  // -------------------------------------------------------------
  // Check 2: Buttons and Links without accessible names
  // -------------------------------------------------------------
  const interactiveElements = elements.filter((el) => {
    if (el.tagName === "button") return true;
    if (el.tagName === "a" && el.attrs.has("href")) return true;
    const role = el.attrs.get("role");
    if (role === "button" || role === "link") return true;
    return false;
  });

  for (const interactive of interactiveElements) {
    if (!hasAccessibleName(interactive)) {
      addFinding(
        "accessibility",
        "critical",
        `Interactive <${interactive.tagName}> lacks accessible name`,
        "Add descriptive text content or an aria-label attribute for screen readers.",
        0.95,
        interactive.editorId ? [interactive.editorId] : [],
        `<${interactive.tagName}> element has no text, aria-label, title, or labeled child icon.`
      );
    }
  }

  // -------------------------------------------------------------
  // Check 3: Missing or multiple <h1>
  // -------------------------------------------------------------
  const h1Elements = elements.filter((el) => el.tagName === "h1");
  if (h1Elements.length === 0) {
    addFinding(
      "hierarchy",
      "critical",
      "Missing <h1> heading",
      "Add a single, descriptive <h1> heading to define the main subject of the document.",
      1.0,
      [],
      "Document contains 0 <h1> elements."
    );
  } else if (h1Elements.length > 1) {
    const affectedIds = h1Elements
      .map((el) => el.editorId)
      .filter((id): id is string => Boolean(id));
    addFinding(
      "hierarchy",
      "warning",
      "Multiple <h1> headings found",
      "Ensure the document contains only one <h1> as the primary page title. Use <h2> for major sections.",
      0.95,
      affectedIds,
      `Document contains ${h1Elements.length} <h1> elements.`
    );
  }

  // -------------------------------------------------------------
  // Check 4: Skipped heading levels
  // -------------------------------------------------------------
  const headingRegex = /^h([1-6])$/;
  const headings = elements.filter((el) => headingRegex.test(el.tagName));
  let lastHeadingLevel = 0;

  for (const h of headings) {
    const match = h.tagName.match(headingRegex);
    if (!match) continue;
    const currentLevel = parseInt(match[1], 10);

    if (lastHeadingLevel > 0 && currentLevel > lastHeadingLevel + 1) {
      addFinding(
        "hierarchy",
        "warning",
        `Skipped heading level from <h${lastHeadingLevel}> to <h${currentLevel}>`,
        `Use <h${lastHeadingLevel + 1}> instead to maintain a sequential and accessible heading hierarchy.`,
        0.9,
        h.editorId ? [h.editorId] : [],
        `<h${currentLevel}> immediately follows <h${lastHeadingLevel}>, skipping level(s) in between.`
      );
    }
    lastHeadingLevel = currentLevel;
  }

  // -------------------------------------------------------------
  // Check 5: Missing <main> landmark
  // -------------------------------------------------------------
  const hasMain = elements.some(
    (el) => el.tagName === "main" || el.attrs.get("role") === "main"
  );
  if (!hasMain) {
    addFinding(
      "hierarchy",
      "warning",
      "Missing <main> landmark",
      "Wrap the core content in a <main> element to provide essential landmark navigation for assistive technologies.",
      1.0,
      [],
      "No <main> tag or role=\"main\" landmark found in document."
    );
  }

  // -------------------------------------------------------------
  // Check 6: Mobile overflow at 390px
  // -------------------------------------------------------------
  // Fixed widths exceeding 390px
  const wideFixedTailwindRegex = /^(?:min-)?w-(?:\[(\d+)px\]|104|112|120|128|144|160|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl)$/;

  for (const el of elements) {
    if (el.tagName === "html" || el.tagName === "body" || el.tagName === "head") {
      continue;
    }

    let detectedOverflow = false;
    let overflowEvidence = "";

    // 1. Check style attribute: width, min-width
    if (el.style) {
      const widthMatch = el.style.match(/(?:min-)?width\s*:\s*(\d+)px/i);
      if (widthMatch) {
        const px = parseInt(widthMatch[1], 10);
        if (px > 390) {
          detectedOverflow = true;
          overflowEvidence = `Inline style specifies ${widthMatch[0]} exceeding 390px mobile viewport width.`;
        }
      }
    }

    // 2. Check HTML width attribute on tables/elements
    const widthAttr = el.attrs.get("width");
    if (widthAttr && /^\d+$/.test(widthAttr)) {
      const px = parseInt(widthAttr, 10);
      if (px > 390 && el.tagName !== "svg") {
        detectedOverflow = true;
        overflowEvidence = `Attribute width="${widthAttr}" exceeds 390px mobile viewport width.`;
      }
    }

    // 3. Check Tailwind fixed classes
    if (!detectedOverflow) {
      for (const cls of el.classes) {
        // Exclude responsive prefixes like md:, lg:, sm:
        if (cls.includes(":")) continue;

        const match = cls.match(wideFixedTailwindRegex);
        if (match) {
          // If bracket notation e.g. w-[500px]
          if (match[1]) {
            const px = parseInt(match[1], 10);
            if (px > 390) {
              detectedOverflow = true;
              overflowEvidence = `Class "${cls}" (${px}px) exceeds 390px mobile viewport width.`;
              break;
            }
          } else {
            // Named wide Tailwind class e.g. min-w-lg (512px), w-128 (512px)
            detectedOverflow = true;
            overflowEvidence = `Fixed width class "${cls}" exceeds 390px mobile viewport width.`;
            break;
          }
        }
      }
    }

    if (detectedOverflow) {
      addFinding(
        "responsive",
        "critical",
        "Element causes horizontal overflow on 390px mobile screens",
        "Replace fixed widths exceeding 390px with responsive classes (e.g. w-full max-w-sm or flex/grid).",
        0.95,
        el.editorId ? [el.editorId] : [],
        overflowEvidence
      );
    }
  }

  // -------------------------------------------------------------
  // Check 7: Likely touch targets below 44x44 px
  // -------------------------------------------------------------
  const smallTailwindClasses = new Set([
    "h-4",
    "h-5",
    "h-6",
    "h-7",
    "h-8",
    "w-4",
    "w-5",
    "w-6",
    "w-7",
    "w-8",
    "p-0",
    "p-0.5",
  ]);

  const explicitSmallBracketRegex = /^[wh]-\[(\d+)px\]$/;

  for (const interactive of interactiveElements) {
    let smallTarget = false;
    let targetEvidence = "";

    // 1. Inline styles
    if (interactive.style) {
      const hMatch = interactive.style.match(/height\s*:\s*(\d+)px/i);
      const wMatch = interactive.style.match(/width\s*:\s*(\d+)px/i);
      if (hMatch && parseInt(hMatch[1], 10) < 44) {
        smallTarget = true;
        targetEvidence = `Inline height is ${hMatch[1]}px (< 44px).`;
      } else if (wMatch && parseInt(wMatch[1], 10) < 44) {
        smallTarget = true;
        targetEvidence = `Inline width is ${wMatch[1]}px (< 44px).`;
      }
    }

    // 2. Tailwind classes
    if (!smallTarget) {
      // Check if it has explicit small dimensions without min-h-[44px] or p-3
      const hasSmallSize = interactive.classes.some((cls) => {
        if (smallTailwindClasses.has(cls)) return true;
        const b = cls.match(explicitSmallBracketRegex);
        if (b && parseInt(b[1], 10) < 44) return true;
        return false;
      });

      const hasSufficientMin = interactive.classes.some((cls) => {
        if (cls === "min-h-[44px]" || cls === "min-w-[44px]" || cls === "min-h-11") return true;
        if (cls.startsWith("p-") && !cls.startsWith("p-0") && !cls.startsWith("p-1")) return true;
        if (cls.startsWith("py-") && !cls.startsWith("py-0") && !cls.startsWith("py-1")) return true;
        return false;
      });

      // If interactive element is specifically an icon button or small pill
      if (hasSmallSize && !hasSufficientMin) {
        smallTarget = true;
        const matchedClasses = interactive.classes.filter((c) =>
          smallTailwindClasses.has(c) || explicitSmallBracketRegex.test(c)
        );
        targetEvidence = `Element uses small sizing classes (${matchedClasses.join(", ")}) below 44px minimum touch target.`;
      }
    }

    if (smallTarget) {
      addFinding(
        "accessibility",
        "warning",
        "Likely touch target below 44×44 px",
        "Ensure interactive touch targets are at least 44×44 px (or have sufficient padding) to comply with mobile accessibility standards.",
        0.85,
        interactive.editorId ? [interactive.editorId] : [],
        targetEvidence
      );
    }
  }

  // -------------------------------------------------------------
  // Check 8: No visible CTA heuristic
  // -------------------------------------------------------------
  const ctaActionTextRegex = /\b(get started|sign up|start free|try free|join now|buy now|subscribe|download|request demo|book a call|order now|contact sales|explore plans)\b/i;
  const prominentCtaClassRegex = /(?:bg-(?:primary|indigo|blue|emerald|violet|zinc-900|black)|btn-primary)/;

  let hasProminentCTA = false;

  for (const interactive of interactiveElements) {
    if (ctaActionTextRegex.test(interactive.textContent)) {
      hasProminentCTA = true;
      break;
    }
    for (const cls of interactive.classes) {
      if (prominentCtaClassRegex.test(cls)) {
        hasProminentCTA = true;
        break;
      }
    }
    if (hasProminentCTA) break;
  }

  if (!hasProminentCTA) {
    addFinding(
      "conversion",
      "warning",
      "No prominent Call-to-Action (CTA) found",
      "Add a prominent, high-contrast Call-to-Action button (e.g. 'Get Started' or 'Sign Up') to guide visitors toward primary conversion goals.",
      0.8,
      [],
      "No interactive button or link matches high-converting CTA text or prominent visual styling."
    );
  }

  // -------------------------------------------------------------
  // Deterministic Scoring & Aggregation
  // -------------------------------------------------------------
  const severityCounts = {
    critical: findings.filter((f) => f.severity === "critical").length,
    warning: findings.filter((f) => f.severity === "warning").length,
    info: findings.filter((f) => f.severity === "info").length,
  };

  const categoryCounts = {
    accessibility: findings.filter((f) => f.category === "accessibility").length,
    responsive: findings.filter((f) => f.category === "responsive").length,
    hierarchy: findings.filter((f) => f.category === "hierarchy").length,
    conversion: findings.filter((f) => f.category === "conversion").length,
  };

  // Base score 100: -15 per critical, -6 per warning, -2 per info
  const calculatedScore = Math.max(
    0,
    Math.min(
      100,
      100 -
        severityCounts.critical * 15 -
        severityCounts.warning * 6 -
        severityCounts.info * 2
    )
  );

  return {
    id: `ux-analysis-${Date.now()}`,
    timestamp: new Date().toISOString(),
    score: calculatedScore,
    severityCounts,
    categoryCounts,
    findings,
    viewport,
    documentRevision: revision,
  };
}

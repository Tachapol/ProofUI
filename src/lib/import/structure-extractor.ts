import { ExtractedStructure } from "./schemas";
import { EvidenceTracker } from "./evidence";

export interface StructureExtractionOptions {
  maxNodes?: number;
  maxDepth?: number;
}

export function buildStructuralExtractorScript(options: StructureExtractionOptions = {}) {
  const maxNodes = options.maxNodes ?? 2000;
  const maxDepth = options.maxDepth ?? 32;

  // Code string to execute inside page.evaluate()
  return `(() => {
    let nodeCount = 0;
    const maxNodes = ${maxNodes};
    const maxDepth = ${maxDepth};
    const headings = [];
    const landmarks = [];

    const IGNORED_TAGS = new Set([
      "script", "style", "noscript", "template", "svg", "path", "meta", "link",
      "iframe", "object", "embed"
    ]);

    function isVisible(el) {
      if (!el || el.nodeType !== 1) return false;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
        return false;
      }
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        return false;
      }
      return true;
    }

    function sanitizeSafeAttributes(el) {
      const attrs = {};
      const allowed = ["id", "class", "role", "alt", "title", "href", "src", "type", "name", "placeholder"];
      for (const attr of el.attributes) {
        const name = attr.name.toLowerCase();
        if (allowed.includes(name) || name.startsWith("aria-") || name.startsWith("data-")) {
          // Exclude event handlers or javascript:
          if (name.startsWith("on") || attr.value.toLowerCase().startsWith("javascript:")) {
            continue;
          }
          attrs[name] = attr.value;
        }
      }
      return attrs;
    }

    function processNode(el, depth, idPrefix) {
      if (nodeCount >= maxNodes || depth > maxDepth) return null;
      if (IGNORED_TAGS.has(el.tagName.toLowerCase())) return null;

      nodeCount++;
      const captureId = idPrefix + "_" + nodeCount;
      const tagName = el.tagName.toLowerCase();
      const rect = el.getBoundingClientRect();

      let visibility = "visible";
      if (!isVisible(el)) {
        visibility = "hidden";
      } else if (rect.bottom < 0 || rect.top > window.innerHeight * 4) {
        visibility = "offscreen";
      }

      // Collect headings
      if (/^h[1-6]$/.test(tagName)) {
        headings.push({
          level: parseInt(tagName.charAt(1), 10),
          text: (el.textContent || "").trim().slice(0, 80),
          captureId,
        });
      }

      // Collect landmarks
      if (["header", "nav", "main", "footer", "section", "aside"].includes(tagName) || el.getAttribute("role")) {
        landmarks.push({
          tag: tagName,
          role: el.getAttribute("role") || undefined,
          captureId,
        });
      }

      const textContent = Array.from(el.childNodes)
        .filter(n => n.nodeType === 3)
        .map(n => n.textContent || "")
        .join(" ")
        .trim();

      const children = [];
      for (let i = 0; i < el.children.length; i++) {
        if (nodeCount >= maxNodes) break;
        const childNode = processNode(el.children[i], depth + 1, idPrefix);
        if (childNode) {
          children.push(childNode);
        }
      }

      return {
        captureId,
        tagName,
        role: el.getAttribute("role") || undefined,
        semanticLabel: el.getAttribute("aria-label") || el.getAttribute("title") || undefined,
        textPreview: textContent ? textContent.slice(0, 100) : undefined,
        attributes: sanitizeSafeAttributes(el),
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
        visibility,
        children,
      };
    }

    const rootEl = document.body || document.documentElement;
    const rootNode = processNode(rootEl, 0, "c");

    return {
      root: rootNode || {
        captureId: "c_root",
        tagName: "body",
        attributes: {},
        visibility: "visible",
        children: [],
      },
      totalNodeCount: nodeCount,
      maxDepth: maxDepth,
      headings,
      landmarks,
    };
  })()`;
}

export function recordStructureEvidence(
  structure: ExtractedStructure,
  tracker: EvidenceTracker
) {
  tracker.add({
    category: "structure",
    source: "dom",
    description: `Extracted reduced semantic DOM with ${structure.totalNodeCount} nodes and ${structure.landmarks.length} landmarks.`,
    confidence: 0.95,
  });

  if (structure.headings.length > 0) {
    tracker.add({
      category: "structure",
      source: "dom",
      description: `Discovered ${structure.headings.length} headings (H1..H6) in document flow.`,
      confidence: 0.98,
    });
  }
}

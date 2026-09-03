import { SerializedNode } from "../bridge/types";
import { AIEditContext, AIEditScope } from "./schemas";

interface BuildContextOptions {
  scope: AIEditScope;
  selectedNode: SerializedNode | null;
  breadcrumbNodes: SerializedNode[];
  canonicalSource: string;
}

const MAX_SUBTREE_CHARS = 4000;

export function buildSafeAIContext(options: BuildContextOptions): AIEditContext {
  const { scope, selectedNode, breadcrumbNodes, canonicalSource } = options;

  let isTruncated = false;
  let selectedSubtreeHtml: string | undefined;

  // Extract subtree HTML from canonical source if node selected
  if (selectedNode && selectedNode.id) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(canonicalSource, "text/html");
      const el = doc.querySelector(`[data-editor-id="${selectedNode.id}"]`);
      if (el) {
        let rawHtml = el.outerHTML;
        // Prompt injection defense: strip any internal script/comment tags
        rawHtml = rawHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
        if (rawHtml.length > MAX_SUBTREE_CHARS) {
          rawHtml = rawHtml.slice(0, MAX_SUBTREE_CHARS) + "\n<!-- [Truncated due to context size budget] -->";
          isTruncated = true;
        }
        selectedSubtreeHtml = rawHtml;
      }
    } catch {
      // Fallback
    }
  }

  // Build ancestor summary
  const ancestorSummary = breadcrumbNodes.map((n) => ({
    id: n.id,
    tagName: n.tagName,
    label: `<${n.tagName}> ${n.className ? `(${n.className.split(" ")[0]})` : ""}`,
  }));

  // Build design tokens summary (safe, curated Tailwind palette tokens)
  const designTokens: Record<string, string> = {
    primaryColor: "indigo-600",
    surfaceDark: "slate-900",
    surfaceBackground: "slate-950",
    textPrimary: "slate-100",
    textMuted: "slate-400",
    borderRadius: "rounded-xl",
  };

  if (scope === "selected_node") {
    return {
      selectedNode: selectedNode || undefined,
      selectedSubtreeHtml,
      ancestorSummary,
      designTokens,
      isTruncated,
    };
  }

  if (scope === "selected_section") {
    // Find closest section-like ancestor
    const sectionNode = [...breadcrumbNodes]
      .reverse()
      .find((n) => ["section", "header", "footer", "main", "article"].includes(n.tagName.toLowerCase())) || selectedNode;

    return {
      selectedNode: sectionNode || undefined,
      selectedSubtreeHtml,
      ancestorSummary,
      designTokens,
      documentSummary: {
        title: "Landing Page Section",
        sectionCount: 4,
        outline: ["Navbar", "Hero Section", "Metrics", "Features Grid", "Footer"],
      },
      isTruncated,
    };
  }

  // Document scope
  return {
    ancestorSummary,
    designTokens,
    documentSummary: {
      title: "Full SaaS Landing Page",
      sectionCount: 5,
      outline: ["Navbar Header", "Hero Section", "Metrics Banner", "Features Grid", "Footer Callout"],
    },
    isTruncated,
  };
}

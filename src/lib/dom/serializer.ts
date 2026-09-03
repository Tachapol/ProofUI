import { SerializedNode } from "../bridge/types";

export const IGNORED_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "LINK",
  "META",
  "HEAD",
  "HTML",
]);

export const SEMANTIC_SECTIONS = new Set([
  "HEADER",
  "FOOTER",
  "MAIN",
  "NAV",
  "SECTION",
  "ARTICLE",
  "ASIDE",
]);

/**
 * Generates a persistent opaque unique ID for an editable node.
 * Format: node_550e8400-e29b-41d4-a716-446655440000
 */
export function generateNodeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `node_${crypto.randomUUID()}`;
  }
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  return `node_${s4()}${s4()}-${s4()}-4${s4().substring(0, 3)}-a${s4().substring(0, 3)}-${s4()}${s4()}${s4()}`;
}

/**
 * Assigns stable, persistent opaque `data-editor-id` attributes to DOM elements.
 * Preserves any valid existing `data-editor-id`.
 * Does NOT derive IDs from tree hierarchy or sibling index.
 */
export function assignEditorIds(root: Element): void {
  if (!root || IGNORED_TAGS.has(root.tagName.toUpperCase())) {
    return;
  }

  if (!root.getAttribute("data-editor-id")) {
    root.setAttribute("data-editor-id", generateNodeId());
  }

  for (let i = 0; i < root.children.length; i++) {
    const child = root.children[i];
    if (!IGNORED_TAGS.has(child.tagName.toUpperCase())) {
      assignEditorIds(child);
    }
  }
}

/**
 * Regenerates new stable IDs for a duplicated subtree root and all its descendants.
 * Used during node duplication to ensure all cloned nodes receive fresh identities.
 */
export function reassignSubtreeIds(root: Element): void {
  if (!root || IGNORED_TAGS.has(root.tagName.toUpperCase())) {
    return;
  }
  root.setAttribute("data-editor-id", generateNodeId());

  for (let i = 0; i < root.children.length; i++) {
    const child = root.children[i];
    if (!IGNORED_TAGS.has(child.tagName.toUpperCase())) {
      reassignSubtreeIds(child);
    }
  }
}

/**
 * Serializes a DOM element tree into a clean JSON structure for the editor shell.
 */
export function serializeDomTree(element: Element): SerializedNode {
  const tagName = element.tagName.toLowerCase();
  const id = element.getAttribute("data-editor-id") || "";
  const className = element.className && typeof element.className === "string" ? element.className : "";

  // Extract direct or shallow text preview
  let textContent: string | undefined;
  if (element.children.length === 0) {
    const raw = element.textContent?.trim();
    if (raw) {
      textContent = raw.length > 45 ? `${raw.slice(0, 42)}...` : raw;
    }
  } else {
    // If element has direct text nodes
    const directText = Array.from(element.childNodes)
      .filter((n) => n.nodeType === 3 /* Node.TEXT_NODE */)
      .map((n) => n.textContent?.trim())
      .filter(Boolean)
      .join(" ");
    if (directText) {
      textContent = directText.length > 40 ? `${directText.slice(0, 37)}...` : directText;
    }
  }

  // Useful attributes
  const attributes: Record<string, string> = {};
  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes[i];
    if (["id", "href", "src", "alt", "placeholder", "type", "role", "title", "aria-label", "target", "rel"].includes(attr.name)) {
      attributes[attr.name] = attr.value;
    }
  }

  const isComponentOrSection =
    SEMANTIC_SECTIONS.has(element.tagName.toUpperCase()) ||
    element.getAttribute("role") === "region" ||
    element.getAttribute("role") === "navigation" ||
    element.hasAttribute("data-component");

  // Collect serialized child elements
  const children: SerializedNode[] = [];
  for (let i = 0; i < element.children.length; i++) {
    const child = element.children[i];
    if (!IGNORED_TAGS.has(child.tagName.toUpperCase())) {
      children.push(serializeDomTree(child));
    }
  }

  return {
    id,
    tagName,
    className,
    textContent,
    children,
    attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
    isComponentOrSection,
  };
}

/**
 * Finds a node within a SerializedNode tree by data-editor-id.
 */
export function findNodeById(tree: SerializedNode, id: string): SerializedNode | null {
  if (tree.id === id) {
    return tree;
  }
  for (const child of tree.children) {
    const found = findNodeById(child, id);
    if (found) {
      return found;
    }
  }
  return null;
}

/**
 * Returns the breadcrumb ancestry path of nodes leading to targetId.
 */
export function getNodePath(tree: SerializedNode, targetId: string): SerializedNode[] {
  if (tree.id === targetId) {
    return [tree];
  }
  for (const child of tree.children) {
    const subPath = getNodePath(child, targetId);
    if (subPath.length > 0) {
      return [tree, ...subPath];
    }
  }
  return [];
}

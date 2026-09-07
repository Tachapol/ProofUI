import * as parse5 from "parse5";

type HtmlNode = {
  nodeName: string;
  tagName?: string;
  value?: string;
  data?: string;
  name?: string;
  publicId?: string;
  systemId?: string;
  attrs?: Array<{ name: string; value: string }>;
  childNodes?: HtmlNode[];
};

const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
  "meta", "param", "source", "track", "wbr",
]);
const RAW_TEXT_TAGS = new Set(["script", "style", "pre", "textarea"]);

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function openingTag(node: HtmlNode): string {
  const tagName = node.tagName || node.nodeName;
  const attributes = (node.attrs || [])
    .map((attribute) => ` ${attribute.name}="${escapeAttribute(attribute.value)}"`)
    .join("");
  return `<${tagName}${attributes}>`;
}

function formatNode(node: HtmlNode, depth: number, parentTag?: string): string[] {
  const indent = "  ".repeat(depth);

  if (node.nodeName === "#document") {
    return (node.childNodes || []).flatMap((child) => formatNode(child, depth));
  }
  if (node.nodeName === "#documentType") {
    const publicId = node.publicId ? ` PUBLIC "${node.publicId}"` : "";
    const systemId = node.systemId ? ` "${node.systemId}"` : "";
    return [`${indent}<!DOCTYPE ${node.name || "html"}${publicId}${systemId}>`];
  }
  if (node.nodeName === "#comment") {
    return [`${indent}<!--${node.data || ""}-->`];
  }
  if (node.nodeName === "#text") {
    if (!node.value || !node.value.trim()) return [];
    // Whitespace in pre/textarea/script/style is meaningful, so never indent or
    // normalize it. This keeps formatting a presentation-only change.
    if (RAW_TEXT_TAGS.has(parentTag || "")) return [node.value];
    const value = node.value.trim().replace(/\s+/g, " ");
    return value.split("\n").map((line) => `${indent}${line}`);
  }

  const tagName = (node.tagName || node.nodeName).toLowerCase();
  const children = node.childNodes || [];
  const open = `${indent}${openingTag(node)}`;
  if (VOID_TAGS.has(tagName)) return [open];

  if (children.length === 0) return [`${open}</${tagName}>`];
  const childLines = children.flatMap((child) => formatNode(child, depth + 1, tagName));
  return [open, ...childLines, `${indent}</${tagName}>`];
}

/**
 * Formats HTML for human-readable code views. parse5 first normalizes malformed
 * markup, so callers should still validate before allowing a draft to be applied.
 */
export function formatHtml(html: string): string {
  if (!html.trim()) return html;
  try {
    const document = parse5.parse(html) as unknown as HtmlNode;
    return `${formatNode(document, 0).join("\n").trim()}\n`;
  } catch {
    return html;
  }
}

import { JSDOM } from "jsdom";
import { generateNodeId } from "../dom/serializer";

function parseDocumentUniversal(html: string): Document {
  if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
    const parser = new DOMParser();
    return parser.parseFromString(html, "text/html");
  }
  const dom = new JSDOM(html);
  return dom.window.document as unknown as Document;
}

function serializeDocumentUniversal(doc: Document): string {
  const html = doc.documentElement ? doc.documentElement.outerHTML : (doc.body ? doc.body.outerHTML : "");
  return `<!DOCTYPE html>\n${html}`;
}

export interface ReconstructionOptions {
  sourceUrl: string;
  title: string;
  capturedAt: string;
}

export function reconstructStaticHtml(
  rawHtml: string,
  options: ReconstructionOptions
): string {
  const doc = parseDocumentUniversal(rawHtml);

  // 1. Remove all original scripts, noscript, iframes, objects, embeds
  const dangerousTags = doc.querySelectorAll("script, noscript, iframe, object, embed, base");
  for (const tag of Array.from(dangerousTags)) {
    tag.remove();
  }

  // 2. Remove all inline event handlers (on*) and sanitize attributes
  const allElements = Array.from(doc.querySelectorAll("*"));
  for (const el of allElements) {
    const attrsToRemove: string[] = [];
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      // Remove event handlers
      if (name.startsWith("on")) {
        attrsToRemove.push(attr.name);
      }
      // Sanitize javascript: in URLs
      if (
        (name === "href" || name === "src" || name === "action") &&
        attr.value.toLowerCase().startsWith("javascript:")
      ) {
        el.setAttribute(attr.name, "#");
      }
    }
    for (const a of attrsToRemove) {
      el.removeAttribute(a);
    }

    // Neutralize forms
    if (el.tagName.toLowerCase() === "form") {
      el.setAttribute("onsubmit", "return false");
      el.removeAttribute("action");
      el.removeAttribute("method");
    }
  }

  // 3. Assign fresh persistent data-editor-id to every node
  if (doc.body) {
    if (!doc.body.getAttribute("data-editor-id")) {
      doc.body.setAttribute("data-editor-id", "body-root");
    }

    for (const el of Array.from(doc.body.querySelectorAll("*"))) {
      if (!el.getAttribute("data-editor-id")) {
        el.setAttribute("data-editor-id", generateNodeId());
      }
    }
  }

  // 4. Ensure Title and Head elements
  if (!doc.head) {
    const head = doc.createElement("head");
    doc.documentElement.insertBefore(head, doc.body);
  }

  let titleEl = doc.querySelector("title");
  if (!titleEl) {
    titleEl = doc.createElement("title");
    titleEl.textContent = options.title || "Imported Website";
    doc.head.appendChild(titleEl);
  }

  // 5. Ensure Tailwind script for styling if not present
  const hasTailwind = Array.from(doc.head.querySelectorAll("script")).some(
    (s) => s.src && s.src.includes("tailwindcss")
  );
  if (!hasTailwind) {
    const tailwindScript = doc.createElement("script");
    tailwindScript.src = "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4";
    doc.head.appendChild(tailwindScript);
  }

  // 6. Serialize and prepend Provenance Comment
  const serialized = serializeDocumentUniversal(doc);
  const provenanceComment = `<!-- ProofUI Import Provenance: source="${encodeURI(
    options.sourceUrl
  )}" capturedAt="${options.capturedAt}" -->\n`;

  return provenanceComment + serialized;
}

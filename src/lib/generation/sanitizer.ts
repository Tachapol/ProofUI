import { JSDOM } from "jsdom";
import { generateNodeId } from "../dom/serializer";
import { validateHtmlSource, ValidationResult } from "../code/code-validation";

export interface GenerationSanitizationResult {
  isValid: boolean;
  sanitizedHtml: string;
  diagnostics: ValidationResult["diagnostics"];
  assignedCount: number;
}

function parseDocument(html: string): Document {
  if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
    return new DOMParser().parseFromString(html, "text/html");
  }
  const dom = new JSDOM(html);
  return dom.window.document as unknown as Document;
}

function serializeDocument(doc: Document): string {
  const html = doc.documentElement ? doc.documentElement.outerHTML : (doc.body ? doc.body.outerHTML : "");
  return `<!DOCTYPE html>\n${html}`;
}

export function sanitizeGeneratedHtml(rawHtml: string): GenerationSanitizationResult {
  if (!rawHtml || !rawHtml.trim()) {
    return {
      isValid: false,
      sanitizedHtml: "",
      diagnostics: [
        {
          severity: "error",
          message: "HTML source cannot be empty.",
          line: 1,
          column: 1,
          code: "EMPTY_DOCUMENT",
        },
      ],
      assignedCount: 0,
    };
  }

  let doc: Document;
  try {
    doc = parseDocument(rawHtml);
  } catch (err) {
    return {
      isValid: false,
      sanitizedHtml: "",
      diagnostics: [
        {
          severity: "error",
          message: `Parser failure: ${err instanceof Error ? err.message : String(err)}`,
          line: 1,
          column: 1,
          code: "PARSE_ERROR",
        },
      ],
      assignedCount: 0,
    };
  }

  let assignedCount = 0;

  // 2. Remove all dangerous tags: scripts, noscripts, iframes, objects, embeds, base
  const dangerousTags = doc.querySelectorAll("script, noscript, iframe, object, embed, base");
  for (const el of Array.from(dangerousTags)) {
    el.remove();
  }

  // 3. Remove inline on* handlers and sanitize attributes
  const allElements = Array.from(doc.querySelectorAll("*"));
  for (const el of allElements) {
    const attrsToRemove: string[] = [];
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      // Purge event handlers
      if (name.startsWith("on")) {
        attrsToRemove.push(attr.name);
      }
      // Sanitize javascript: / data:text/html URLs
      if (
        (name === "href" || name === "src" || name === "action") &&
        (attr.value.toLowerCase().startsWith("javascript:") ||
          attr.value.toLowerCase().startsWith("data:text/html"))
      ) {
        el.setAttribute(attr.name, "#");
      }
      // Purge dangerous srcdoc
      if (name === "srcdoc") {
        attrsToRemove.push(attr.name);
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

  // 4. Ensure stable persistent data-editor-id on every element
  if (doc.body) {
    if (!doc.body.getAttribute("data-editor-id")) {
      doc.body.setAttribute("data-editor-id", "body-root");
      assignedCount++;
    }

    for (const el of Array.from(doc.body.querySelectorAll("*"))) {
      if (!el.getAttribute("data-editor-id")) {
        el.setAttribute("data-editor-id", generateNodeId());
        assignedCount++;
      }
    }
  }

  // 5. Ensure Tailwind script in head if not present
  if (!doc.head) {
    const head = doc.createElement("head");
    doc.documentElement.insertBefore(head, doc.body);
  }

  const hasTailwind = Array.from(doc.head.querySelectorAll("script")).some(
    (s) => s.src && s.src.includes("tailwindcss")
  );
  if (!hasTailwind) {
    const tailwindScript = doc.createElement("script");
    tailwindScript.src = "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4";
    doc.head.appendChild(tailwindScript);
  }

  const sanitizedHtml = serializeDocument(doc);

  // 6. Final verification of sanitized output
  const finalValidation = validateHtmlSource(sanitizedHtml);

  return {
    isValid: finalValidation.isValid,
    sanitizedHtml: finalValidation.isValid ? sanitizedHtml : "",
    diagnostics: finalValidation.diagnostics,
    assignedCount,
  };
}

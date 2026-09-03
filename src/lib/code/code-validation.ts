import * as parse5 from "parse5";
import { CodeDiagnostic } from "./diagnostics";

export interface ValidationResult {
  isValid: boolean;
  diagnostics: CodeDiagnostic[];
  parsedDocument: Document | null;
}

interface ASTElement {
  tagName: string;
  attributes: Array<{ name: string; value: string }>;
  getAttribute: (name: string) => string | null;
  textContent: string;
}

type Parse5Node = {
  nodeName: string;
  tagName?: string;
  value?: string;
  attrs?: Array<{ name: string; value: string }>;
  childNodes?: Parse5Node[];
};

interface ValidationElement {
  tagName: string;
  attributes: Array<{ name: string; value?: string }> | NamedNodeMap;
  getAttribute: (name: string) => string | null;
  textContent?: string | null;
}

interface ValidationDocument {
  body: ValidationElement | null;
  querySelectorAll: (selector: string) => ValidationElement[] | NodeListOf<Element>;
}

function getTextContent(node: Parse5Node): string {
  if (!node) return "";
  if (node.nodeName === "#text") return node.value || "";
  if (node.childNodes) {
    return node.childNodes.map(getTextContent).join("");
  }
  return "";
}

function createASTElement(node: Parse5Node): ASTElement {
  const attrs: Array<{ name: string; value: string }> = node.attrs || [];
  return {
    tagName: (node.tagName || node.nodeName || "").toUpperCase(),
    attributes: attrs,
    getAttribute(name: string) {
      const target = attrs.find((a) => a.name.toLowerCase() === name.toLowerCase());
      return target ? target.value : null;
    },
    textContent: getTextContent(node),
  };
}

function collectASTElements(node: Parse5Node, result: ASTElement[] = []): ASTElement[] {
  if (!node) return result;
  if (node.tagName || (node.nodeName && !node.nodeName.startsWith("#"))) {
    result.push(createASTElement(node));
  }
  if (node.childNodes) {
    for (const child of node.childNodes) {
      collectASTElements(child, result);
    }
  }
  return result;
}

// Find line and column for a substring or regex in source HTML
export function findPositionInHtml(
  html: string,
  target: string | RegExp
): { line: number; column: number } {
  let index = -1;
  if (typeof target === "string") {
    index = html.indexOf(target);
  } else {
    const match = target.exec(html);
    index = match ? match.index : -1;
  }

  if (index === -1) {
    return { line: 1, column: 1 };
  }

  const lines = html.slice(0, index).split("\n");
  const line = lines.length;
  const column = lines[lines.length - 1].length + 1;
  return { line, column };
}

export function validateHtmlSource(html: string): ValidationResult {
  const diagnostics: CodeDiagnostic[] = [];

  if (!html || !html.trim()) {
    return {
      isValid: false,
      diagnostics: [
        {
          severity: "error",
          message: "HTML source cannot be empty.",
          line: 1,
          column: 1,
          code: "EMPTY_DOCUMENT",
        },
      ],
      parsedDocument: null,
    };
  }

  // 1. Strict HTML5 Parsing with parse5
  const parse5Errors: Array<{
    code: string;
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
  }> = [];

  let parsedAst: Parse5Node | null = null;
  try {
    parsedAst = parse5.parse(html, {
      sourceCodeLocationInfo: true,
      onParseError: (err) => {
        parse5Errors.push(err);
      },
    }) as unknown as Parse5Node;
  } catch (err) {
    return {
      isValid: false,
      diagnostics: [
        {
          severity: "error",
          message: `HTML Parser fatal failure: ${err instanceof Error ? err.message : String(err)}`,
          line: 1,
          column: 1,
          code: "PARSE_ERROR",
        },
      ],
      parsedDocument: null,
    };
  }

  for (const pErr of parse5Errors) {
    const isWarning = [
      "missing-doctype",
      "non-void-html-element-start-tag-with-trailing-solidus",
      "duplicate-attribute",
      "surrogate-character",
    ].includes(pErr.code);

    diagnostics.push({
      severity: isWarning ? "warning" : "error",
      message: `HTML ${isWarning ? "warning" : "syntax error"}: ${pErr.code.replace(/-/g, " ")}`,
      line: pErr.startLine || 1,
      column: pErr.startCol || 1,
      code: isWarning ? "PARSE_WARNING" : "PARSE_ERROR",
      length: Math.max(1, (pErr.endCol || pErr.startCol || 1) - (pErr.startCol || 1)),
    });
  }

  // If there are hard parse5 errors, fail early with diagnostics
  if (diagnostics.some((d) => d.severity === "error")) {
    return { isValid: false, diagnostics, parsedDocument: null };
  }

  // 2. Structural DOM check (DOMParser in browser, parse5 AST adapter in Node.js)
  let doc: ValidationDocument;
  if (typeof DOMParser !== "undefined") {
    let browserDoc: Document;
    try {
      const parser = new DOMParser();
      browserDoc = parser.parseFromString(html, "text/html");
    } catch (err) {
      return {
        isValid: false,
        diagnostics: [
          {
            severity: "error",
            message: `HTML Parser failure: ${err instanceof Error ? err.message : String(err)}`,
            line: 1,
            column: 1,
            code: "PARSE_ERROR",
          },
        ],
        parsedDocument: null,
      };
    }

    const domParseErrors = browserDoc.querySelectorAll("parsererror");
    if (domParseErrors.length > 0) {
      const errorText = domParseErrors[0].textContent || "Malformed HTML syntax.";
      diagnostics.push({
        severity: "error",
        message: `Syntax error: ${errorText}`,
        line: 1,
        column: 1,
        code: "PARSE_ERROR",
      });
      return { isValid: false, diagnostics, parsedDocument: null };
    }

    doc = browserDoc as unknown as ValidationDocument;
  } else {
    const allASTElements = parsedAst ? collectASTElements(parsedAst) : [];
    const bodyNode = allASTElements.find((el) => el.tagName.toLowerCase() === "body") || null;
    doc = {
      body: bodyNode,
      querySelectorAll(selector: string) {
        if (selector === "parsererror") return [];
        if (selector === "[data-editor-id]") {
          return allASTElements.filter((el) => el.getAttribute("data-editor-id") !== null);
        }
        if (selector === "*") {
          return allASTElements;
        }
        return [];
      },
    };
  }

  // 2. Usable Body Check
  if (!doc.body) {
    diagnostics.push({
      severity: "error",
      message: "Document must contain a valid <body> element.",
      line: 1,
      column: 1,
      code: "MISSING_BODY",
    });
    return { isValid: false, diagnostics, parsedDocument: null };
  }

  // 3. Duplicate and Malformed Editor IDs Check
  const idCounts = new Map<string, number>();
  const elementsWithEditorId = Array.from(doc.querySelectorAll("[data-editor-id]")) as ValidationElement[];

  elementsWithEditorId.forEach((el) => {
    const id = el.getAttribute("data-editor-id");
    if (!id || !id.trim()) {
      const pos = findPositionInHtml(html, 'data-editor-id=""');
      diagnostics.push({
        severity: "error",
        message: "Found empty data-editor-id attribute.",
        line: pos.line,
        column: pos.column,
        code: "EMPTY_EDITOR_ID",
      });
      return;
    }

    idCounts.set(id, (idCounts.get(id) || 0) + 1);
  });

  idCounts.forEach((count, id) => {
    if (count > 1) {
      const pos = findPositionInHtml(html, `data-editor-id="${id}"`);
      diagnostics.push({
        severity: "error",
        message: `Duplicate data-editor-id detected: "${id}" appears ${count} times.`,
        line: pos.line,
        column: pos.column,
        code: "DUPLICATE_EDITOR_ID",
      });
    }
  });

  // 4. Security & Sanitization Checks
  const allElements = Array.from(doc.querySelectorAll("*")) as ValidationElement[];
  allElements.forEach((el) => {
    const tagName = el.tagName.toLowerCase();

    // Dangerous elements
    if (["base", "object", "embed", "applet"].includes(tagName)) {
      const pos = findPositionInHtml(html, new RegExp(`<${tagName}\\b`, "i"));
      diagnostics.push({
        severity: "error",
        message: `Forbidden <${tagName}> element is not permitted.`,
        line: pos.line,
        column: pos.column,
        code: "FORBIDDEN_TAG",
      });
    }

    // Restrict unexpected scripts
    if (tagName === "script") {
      const isEditorBridge = el.textContent?.includes("ACTIVE_SESSION_ID") || el.getAttribute("data-editor-bridge") === "true";
      const isTailwindCdn = el.getAttribute("src")?.includes("cdn.tailwindcss.com") || el.getAttribute("src")?.includes("tailwindcss");
      if (!isEditorBridge && !isTailwindCdn) {
        const pos = findPositionInHtml(html, /<script\b/i);
        diagnostics.push({
          severity: "warning",
          message: "Custom client scripts may interfere with the visual editor.",
          line: pos.line,
          column: pos.column,
          code: "UNEXPECTED_SCRIPT",
        });
      }
    }

    // Dangerous attributes & inline JS
    const attrs = Array.from(el.attributes || []) as Array<{ name: string; value?: string }>;
    attrs.forEach((attr) => {
      const attrName = attr.name.toLowerCase();
      const attrVal = (attr.value || "").toLowerCase();

      // Inline event handlers (allow harmless neutralized form onsubmit="return false")
      if (attrName.startsWith("on")) {
        if (attrName === "onsubmit" && (attrVal === "return false" || attrVal === "return false;")) {
          return;
        }
        const pos = findPositionInHtml(html, new RegExp(`\\b${attr.name}\\s*=`, "i"));
        diagnostics.push({
          severity: "error",
          message: `Inline event handler "${attr.name}" is forbidden for security.`,
          line: pos.line,
          column: pos.column,
          code: "UNSAFE_EVENT_HANDLER",
        });
      }

      // JavaScript URIs and Unsafe URLs
      if ((attrName === "href" || attrName === "src" || attrName === "action") && (attrVal.startsWith("javascript:") || attrVal.startsWith("data:text/html"))) {
        const pos = findPositionInHtml(html, attrVal.startsWith("javascript:") ? /javascript:/i : /data:text\/html/i);
        diagnostics.push({
          severity: "error",
          message: `Executable URI in "${attr.name}" is forbidden: "${attrVal}".`,
          line: pos.line,
          column: pos.column,
          code: "UNSAFE_URL_PROTOCOL",
        });
      }

      // Dangerous srcdoc
      if (attrName === "srcdoc") {
        const pos = findPositionInHtml(html, /srcdoc\s*=/i);
        diagnostics.push({
          severity: "error",
          message: 'srcdoc attribute on <iframe> is forbidden.',
          line: pos.line,
          column: pos.column,
          code: "DANGEROUS_SRCDOC",
        });
      }

      // Form action hijacking
      if (tagName === "form" && attrName === "action" && attrVal && !attrVal.startsWith("#")) {
        const pos = findPositionInHtml(html, /action\s*=/i);
        diagnostics.push({
          severity: "warning",
          message: "Form action points to external endpoint.",
          line: pos.line,
          column: pos.column,
          code: "EXTERNAL_FORM_ACTION",
        });
      }
    });
  });

  const hasErrors = diagnostics.some((d) => d.severity === "error");

  return {
    isValid: !hasErrors,
    diagnostics,
    parsedDocument: hasErrors ? null : (doc as unknown as Document),
  };
}

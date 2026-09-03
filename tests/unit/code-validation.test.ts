import { describe, it, expect } from "vitest";
import { validateHtmlSource } from "../../src/lib/code/code-validation";

describe("HTML Source Validation and Security Diagnostics", () => {
  const validSampleHtml = `
    <!DOCTYPE html>
    <html lang="en">
      <head><title>Test Page</title></head>
      <body data-editor-id="node_body">
        <main data-editor-id="node_main">
          <h1 data-editor-id="node_h1" class="text-4xl">Title</h1>
          <a data-editor-id="node_link" href="https://example.com">Link</a>
        </main>
      </body>
    </html>
  `;

  it("passes validation on well-formed, safe HTML document", () => {
    const result = validateHtmlSource(validSampleHtml);
    expect(result.isValid).toBe(true);
    expect(result.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    expect(result.parsedDocument).not.toBeNull();
  });

  it("fails validation on empty HTML input", () => {
    const result = validateHtmlSource("   ");
    expect(result.isValid).toBe(false);
    expect(result.diagnostics[0].code).toBe("EMPTY_DOCUMENT");
  });

  it("detects duplicate data-editor-id attributes with line and column", () => {
    const htmlWithDuplicates = `
      <!DOCTYPE html>
      <html>
        <body data-editor-id="node_dup">
          <div data-editor-id="node_dup">Hello</div>
        </body>
      </html>
    `;
    const result = validateHtmlSource(htmlWithDuplicates);
    expect(result.isValid).toBe(false);
    const dupDiag = result.diagnostics.find((d) => d.code === "DUPLICATE_EDITOR_ID");
    expect(dupDiag).toBeDefined();
    expect(dupDiag?.message).toContain("Duplicate data-editor-id detected: \"node_dup\"");
    expect(dupDiag?.line).toBeGreaterThan(0);
  });

  it("rejects inline event-handler attributes (onclick, onload)", () => {
    const unsafeHtml = `
      <!DOCTYPE html>
      <html>
        <body data-editor-id="node_1">
          <button data-editor-id="node_btn" onclick="alert('pwned')">Click</button>
        </body>
      </html>
    `;
    const result = validateHtmlSource(unsafeHtml);
    expect(result.isValid).toBe(false);
    const handlerDiag = result.diagnostics.find((d) => d.code === "UNSAFE_EVENT_HANDLER");
    expect(handlerDiag).toBeDefined();
    expect(handlerDiag?.message).toContain('Inline event handler "onclick" is forbidden');
  });

  it("rejects unsafe URL protocols (javascript:, data:text/html)", () => {
    const unsafeLinkHtml = `
      <!DOCTYPE html>
      <html>
        <body data-editor-id="node_1">
          <a data-editor-id="node_link" href="javascript:void(0)">Bad Link</a>
        </body>
      </html>
    `;
    const result = validateHtmlSource(unsafeLinkHtml);
    expect(result.isValid).toBe(false);
    const urlDiag = result.diagnostics.find((d) => d.code === "UNSAFE_URL_PROTOCOL");
    expect(urlDiag).toBeDefined();
    expect(urlDiag?.message).toContain("javascript:");
  });

  it("rejects forbidden tags such as <base>, <object>, and <embed>", () => {
    const forbiddenHtml = `
      <!DOCTYPE html>
      <html>
        <head><base href="https://attacker.com/"></head>
        <body data-editor-id="node_1">
          <p>Text</p>
        </body>
      </html>
    `;
    const result = validateHtmlSource(forbiddenHtml);
    expect(result.isValid).toBe(false);
    const tagDiag = result.diagnostics.find((d) => d.code === "FORBIDDEN_TAG");
    expect(tagDiag).toBeDefined();
    expect(tagDiag?.message).toContain("<base>");
  });

  it("rejects unexpected srcdoc on <iframe>", () => {
    const srcdocHtml = `
      <!DOCTYPE html>
      <html>
        <body data-editor-id="node_1">
          <iframe data-editor-id="node_frame" srcdoc="<script>evil()</script>"></iframe>
        </body>
      </html>
    `;
    const result = validateHtmlSource(srcdocHtml);
    expect(result.isValid).toBe(false);
    const srcdocDiag = result.diagnostics.find((d) => d.code === "DANGEROUS_SRCDOC");
    expect(srcdocDiag).toBeDefined();
  });

  it("captures parse5 syntax errors with exact line and column locations", () => {
    const brokenHtml = `<!DOCTYPE html>
<html>
  <body data-editor-id="node_1">
    <div id="unclosed`;
    const result = validateHtmlSource(brokenHtml);
    expect(result.isValid).toBe(false);
    const parseError = result.diagnostics.find((d) => d.code === "PARSE_ERROR");
    expect(parseError).toBeDefined();
    expect(parseError?.line).toBe(4);
    expect(parseError?.column).toBe(22);
    expect(parseError?.message).toContain("eof in tag");
  });

  it("distinguishes parse5 warnings (e.g. missing-doctype) from fatal errors", () => {
    const fragmentHtml = `
      <body data-editor-id="node_1">
        <h1 data-editor-id="node_h1">Valid Heading</h1>
      </body>
    `;
    const result = validateHtmlSource(fragmentHtml);
    expect(result.isValid).toBe(true);
    const warning = result.diagnostics.find((d) => d.severity === "warning" && d.code === "PARSE_WARNING");
    expect(warning).toBeDefined();
    expect(warning?.message).toContain("missing doctype");
  });
});

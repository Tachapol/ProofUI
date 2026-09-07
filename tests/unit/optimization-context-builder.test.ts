import { describe, it, expect } from "vitest";
import {
  buildOptimizationInstruction,
  buildOptimizationCandidateSummary,
  buildOptimizationGenerationRequest,
  sanitizeUntrustedInput,
} from "@/lib/optimization/optimization-context-builder";
import { UXFinding, UXOptimizationRequest } from "@/lib/optimization/schemas";

describe("Optimization Context Builder (Milestone 5.2B)", () => {
  const sampleFindings: UXFinding[] = [
    {
      id: "img-alt",
      severity: "critical",
      category: "accessibility",
      title: "Images without alt attribute",
      recommendation: "Add descriptive alt attributes to all <img> elements.",
      confidence: 0.95,
      affectedNodeIds: ["node-img-1", "node-img-2"],
      evidence: '<img src="/test.jpg"> missing alt',
    },
    {
      id: "accessible-name",
      severity: "critical",
      category: "accessibility",
      title: "Interactive elements without accessible name",
      recommendation: "Add aria-label or visible text to button.",
      confidence: 0.9,
      affectedNodeIds: ["node-btn-1"],
      evidence: '<button class="p-2"></button> has no text or aria-label',
    },
    {
      id: "mobile-overflow",
      severity: "warning",
      category: "responsive",
      title: "Potential mobile layout overflow at 390px",
      recommendation: "Use max-w-full and responsive classes.",
      confidence: 0.85,
      affectedNodeIds: ["node-div-fixed"],
      evidence: 'w-[500px] exceeds mobile viewport',
    },
  ];

  it("Test 1: Only selected findings appear in optimization instruction prompt", () => {
    const selected = [sampleFindings[0]]; // Only img-alt selected
    const request: UXOptimizationRequest = {
      html: "<html><body><img src='/test.jpg'></body></html>",
      revision: 3,
      viewport: "mobile",
      selectedFindingIds: ["img-alt"],
      selectedFindings: selected,
    };

    const instruction = buildOptimizationInstruction(request);

    // Selected finding appears
    expect(instruction).toContain("Images without alt attribute");
    expect(instruction).toContain("node-img-1");
    expect(instruction).toContain("node-img-2");

    // Non-selected findings MUST NOT appear
    expect(instruction).not.toContain("Interactive elements without accessible name");
    expect(instruction).not.toContain("Potential mobile layout overflow");
  });

  it("Test 2: Provider receives current revision, canonical HTML, and outline of selected findings", () => {
    const selected = [sampleFindings[0], sampleFindings[2]];
    const request: UXOptimizationRequest = {
      html: "<!DOCTYPE html><html><body><h1>Header</h1><img src='/test.jpg'></body></html>",
      revision: 5,
      viewport: "desktop",
      selectedFindingIds: ["img-alt", "mobile-overflow"],
      selectedFindings: selected,
      userGoal: "Make layout strictly WCAG compliant",
    };

    const genRequest = buildOptimizationGenerationRequest(request);

    expect(genRequest.basedOnRevision).toBe(5);
    expect(genRequest.scope).toBe("new_version");
    expect(genRequest.context.currentDocument?.revision).toBe(5);
    expect(genRequest.context.currentDocument?.html).toContain("<!DOCTYPE html>");
    expect(genRequest.context.currentDocument?.outline).toEqual([
      "Images without alt attribute",
      "Potential mobile layout overflow at 390px",
    ]);
    expect(genRequest.instruction).toContain("Make layout strictly WCAG compliant");
  });

  it("Test 3: Sanitizes untrusted scripts from reference input HTML", () => {
    const maliciousHtml = `
      <html>
        <body>
          <h1>Title</h1>
          <script>alert('xss');</script>
          <script src="https://evil.com/tracker.js"></script>
          <noscript><p>Fallback</p></noscript>
          <p>Normal content</p>
        </body>
      </html>
    `;

    const cleaned = sanitizeUntrustedInput(maliciousHtml);
    expect(cleaned).not.toContain("<script");
    expect(cleaned).not.toContain("evil.com");
    expect(cleaned).not.toContain("<noscript");
    expect(cleaned).toContain("<h1>Title</h1>");
    expect(cleaned).toContain("Normal content");
  });

  it("Test 4: Candidate summary lists exactly which findings it attempted to address", () => {
    const summaryOne = buildOptimizationCandidateSummary([sampleFindings[0]]);
    expect(summaryOne).toBe("Addressed 1 UX finding: Images without alt attribute");

    const summaryMultiple = buildOptimizationCandidateSummary([
      sampleFindings[0],
      sampleFindings[1],
    ]);
    expect(summaryMultiple).toBe(
      "Addressed 2 UX findings: Images without alt attribute; Interactive elements without accessible name"
    );
  });
});

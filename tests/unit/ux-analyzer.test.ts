import { describe, it, expect } from "vitest";
import { analyzeDocumentUX } from "@/lib/optimization/ux-analyzer";

describe("UX Analyzer Engine (Milestone 5.2A)", () => {
  // -------------------------------------------------------------
  // Check 1: Images without alt
  // -------------------------------------------------------------
  describe("Check 1: Images without alt", () => {
    it("flags images missing the alt attribute and extracts editor id", () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <main>
              <h1>Accessible App</h1>
              <img data-editor-id="img-missing" src="/hero.png">
              <button class="bg-indigo-600">Get Started</button>
            </main>
          </body>
        </html>
      `;

      const result = analyzeDocumentUX(html);
      const imgFinding = result.findings.find(
        (f) => f.title === "Image missing alt attribute"
      );
      expect(imgFinding).toBeDefined();
      expect(imgFinding?.severity).toBe("warning");
      expect(imgFinding?.category).toBe("accessibility");
      expect(imgFinding?.affectedNodeIds).toEqual(["img-missing"]);
      expect(imgFinding?.evidence).toContain('<img src="/hero.png">');
    });

    it("passes images with descriptive alt or empty alt", () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <main>
              <h1>Accessible App</h1>
              <img data-editor-id="img-ok" src="/hero.png" alt="Company dashboard preview">
              <img data-editor-id="img-decorative" src="/bg.png" alt="">
              <button class="bg-indigo-600">Get Started</button>
            </main>
          </body>
        </html>
      `;

      const result = analyzeDocumentUX(html);
      const imgFinding = result.findings.find(
        (f) => f.title === "Image missing alt attribute"
      );
      expect(imgFinding).toBeUndefined();
    });
  });

  // -------------------------------------------------------------
  // Check 2: Buttons and links without accessible names
  // -------------------------------------------------------------
  describe("Check 2: Buttons/links without accessible names", () => {
    it("flags buttons and links lacking text or aria-label", () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <main>
              <h1>Title</h1>
              <button data-editor-id="btn-icon-empty"></button>
              <a data-editor-id="link-empty" href="/about"></a>
              <button class="bg-indigo-600">Get Started</button>
            </main>
          </body>
        </html>
      `;

      const result = analyzeDocumentUX(html);
      const btnFinding = result.findings.find(
        (f) =>
          f.title === "Interactive <button> lacks accessible name" &&
          f.affectedNodeIds.includes("btn-icon-empty")
      );
      expect(btnFinding).toBeDefined();
      expect(btnFinding?.severity).toBe("critical");
      expect(btnFinding?.category).toBe("accessibility");

      const linkFinding = result.findings.find(
        (f) =>
          f.title === "Interactive <a> lacks accessible name" &&
          f.affectedNodeIds.includes("link-empty")
      );
      expect(linkFinding).toBeDefined();
    });

    it("passes buttons with aria-label, title, or inner text", () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <main>
              <h1>Title</h1>
              <button data-editor-id="btn-label" aria-label="Close dialog"></button>
              <a data-editor-id="link-text" href="/about">About Us</a>
              <button class="bg-indigo-600">Get Started</button>
            </main>
          </body>
        </html>
      `;

      const result = analyzeDocumentUX(html);
      const findings = result.findings.filter(
        (f) => f.title.includes("lacks accessible name")
      );
      expect(findings).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------
  // Check 3: Missing or multiple <h1>
  // -------------------------------------------------------------
  describe("Check 3: Missing or multiple h1", () => {
    it("flags missing <h1> as critical", () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <main>
              <h2>Subheading only</h2>
              <button class="bg-indigo-600">Get Started</button>
            </main>
          </body>
        </html>
      `;

      const result = analyzeDocumentUX(html);
      const h1Finding = result.findings.find(
        (f) => f.title === "Missing <h1> heading"
      );
      expect(h1Finding).toBeDefined();
      expect(h1Finding?.severity).toBe("critical");
      expect(h1Finding?.category).toBe("hierarchy");
    });

    it("flags multiple <h1> headings as warning with all affected IDs", () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <main>
              <h1 data-editor-id="h1-first">Primary Title</h1>
              <h1 data-editor-id="h1-second">Duplicate Title</h1>
              <button class="bg-indigo-600">Get Started</button>
            </main>
          </body>
        </html>
      `;

      const result = analyzeDocumentUX(html);
      const h1Finding = result.findings.find(
        (f) => f.title === "Multiple <h1> headings found"
      );
      expect(h1Finding).toBeDefined();
      expect(h1Finding?.severity).toBe("warning");
      expect(h1Finding?.affectedNodeIds).toEqual(["h1-first", "h1-second"]);
      expect(h1Finding?.evidence).toContain("2 <h1> elements");
    });

    it("passes when exactly one <h1> is present", () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <main>
              <h1 data-editor-id="h1-ok">Unique Title</h1>
              <h2>Subheading</h2>
              <button class="bg-indigo-600">Get Started</button>
            </main>
          </body>
        </html>
      `;

      const result = analyzeDocumentUX(html);
      const h1Missing = result.findings.find(
        (f) => f.title === "Missing <h1> heading"
      );
      const h1Multiple = result.findings.find(
        (f) => f.title === "Multiple <h1> headings found"
      );
      expect(h1Missing).toBeUndefined();
      expect(h1Multiple).toBeUndefined();
    });
  });

  // -------------------------------------------------------------
  // Check 4: Skipped heading levels
  // -------------------------------------------------------------
  describe("Check 4: Skipped heading levels", () => {
    it("flags heading jump from h1 to h3", () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <main>
              <h1>Title</h1>
              <h3 data-editor-id="h3-skip">Skipped level 2</h3>
              <button class="bg-indigo-600">Get Started</button>
            </main>
          </body>
        </html>
      `;

      const result = analyzeDocumentUX(html);
      const skipFinding = result.findings.find(
        (f) => f.title === "Skipped heading level from <h1 to <h3" || f.title.includes("Skipped heading level")
      );
      expect(skipFinding).toBeDefined();
      expect(skipFinding?.severity).toBe("warning");
      expect(skipFinding?.affectedNodeIds).toEqual(["h3-skip"]);
      expect(skipFinding?.evidence).toContain("<h3");
    });

    it("passes sequential heading levels", () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <main>
              <h1>Main Title</h1>
              <h2>Section Title</h2>
              <h3>Sub Section</h3>
              <button class="bg-indigo-600">Get Started</button>
            </main>
          </body>
        </html>
      `;

      const result = analyzeDocumentUX(html);
      const skipFinding = result.findings.find((f) =>
        f.title.includes("Skipped heading level")
      );
      expect(skipFinding).toBeUndefined();
    });
  });

  // -------------------------------------------------------------
  // Check 5: Missing <main> landmark
  // -------------------------------------------------------------
  describe("Check 5: Missing <main> landmark", () => {
    it("flags document missing a <main> element or role='main'", () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <div>
              <h1>Heading</h1>
              <button class="bg-indigo-600">Get Started</button>
            </div>
          </body>
        </html>
      `;

      const result = analyzeDocumentUX(html);
      const mainFinding = result.findings.find(
        (f) => f.title === "Missing <main> landmark"
      );
      expect(mainFinding).toBeDefined();
      expect(mainFinding?.severity).toBe("warning");
      expect(mainFinding?.category).toBe("hierarchy");
    });

    it("passes when <main> or role='main' exists", () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <main>
              <h1>Heading</h1>
              <button class="bg-indigo-600">Get Started</button>
            </main>
          </body>
        </html>
      `;

      const result = analyzeDocumentUX(html);
      const mainFinding = result.findings.find(
        (f) => f.title === "Missing <main> landmark"
      );
      expect(mainFinding).toBeUndefined();
    });
  });

  // -------------------------------------------------------------
  // Check 6: Mobile overflow at 390px
  // -------------------------------------------------------------
  describe("Check 6: Mobile overflow at 390px", () => {
    it("detects fixed inline widths and Tailwind classes exceeding 390px", () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <main>
              <h1>Heading</h1>
              <div data-editor-id="div-overflow-style" style="width: 500px;">Wide box</div>
              <div data-editor-id="div-overflow-cls" class="w-[450px]">Tailwind wide box</div>
              <button class="bg-indigo-600">Get Started</button>
            </main>
          </body>
        </html>
      `;

      const result = analyzeDocumentUX(html, { viewport: "mobile" });
      const overflowFindings = result.findings.filter(
        (f) => f.category === "responsive"
      );
      expect(overflowFindings.length).toBeGreaterThanOrEqual(2);

      const affectedIds = overflowFindings.flatMap((f) => f.affectedNodeIds);
      expect(affectedIds).toContain("div-overflow-style");
      expect(affectedIds).toContain("div-overflow-cls");
    });

    it("passes fluid responsive layouts with max-w or w-full", () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <main>
              <h1>Heading</h1>
              <div class="w-full max-w-sm mx-auto">Responsive container</div>
              <button class="bg-indigo-600">Get Started</button>
            </main>
          </body>
        </html>
      `;

      const result = analyzeDocumentUX(html, { viewport: "mobile" });
      const overflowFindings = result.findings.filter(
        (f) => f.category === "responsive"
      );
      expect(overflowFindings).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------
  // Check 7: Touch targets below 44x44 px
  // -------------------------------------------------------------
  describe("Check 7: Likely touch targets below 44x44 px", () => {
    it("flags interactive elements with explicit small size classes or styles", () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <main>
              <h1>Heading</h1>
              <button data-editor-id="btn-small-cls" class="w-6 h-6">X</button>
              <a data-editor-id="link-small-style" href="#" style="height: 30px; width: 30px;">Go</a>
              <button class="min-h-[44px] min-w-[44px] bg-indigo-600">Get Started</button>
            </main>
          </body>
        </html>
      `;

      const result = analyzeDocumentUX(html);
      const touchFindings = result.findings.filter((f) =>
        f.title.includes("touch target")
      );
      expect(touchFindings.length).toBeGreaterThanOrEqual(2);

      const affectedIds = touchFindings.flatMap((f) => f.affectedNodeIds);
      expect(affectedIds).toContain("btn-small-cls");
      expect(affectedIds).toContain("link-small-style");
    });
  });

  // -------------------------------------------------------------
  // Check 8: No visible CTA heuristic
  // -------------------------------------------------------------
  describe("Check 8: No visible CTA heuristic", () => {
    it("flags document when no call-to-action button or link is present", () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <main>
              <h1>Documentation</h1>
              <p>Some plain documentation text.</p>
            </main>
          </body>
        </html>
      `;

      const result = analyzeDocumentUX(html);
      const ctaFinding = result.findings.find(
        (f) => f.category === "conversion"
      );
      expect(ctaFinding).toBeDefined();
      expect(ctaFinding?.title).toContain("No prominent Call-to-Action");
      expect(ctaFinding?.severity).toBe("warning");
    });

    it("passes document with primary CTA button text or prominent class", () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <main>
              <h1>Launch Your Product</h1>
              <button data-editor-id="btn-cta" class="bg-indigo-600 text-white px-4 py-2">
                Get Started Free
              </button>
            </main>
          </body>
        </html>
      `;

      const result = analyzeDocumentUX(html);
      const ctaFinding = result.findings.find(
        (f) => f.category === "conversion"
      );
      expect(ctaFinding).toBeUndefined();
    });
  });

  // -------------------------------------------------------------
  // Deterministic Scoring & Stale Revision Verification
  // -------------------------------------------------------------
  describe("Scoring & Document Revision Tracking", () => {
    it("calculates deterministic score based on severity counts and clamps to 0-100", () => {
      const cleanHtml = `
        <!DOCTYPE html>
        <html>
          <body>
            <main>
              <h1>Clean accessible landing page</h1>
              <p>Welcome to our platform.</p>
              <img src="/logo.png" alt="Company Logo">
              <button class="bg-indigo-600 text-white px-4 py-2.5 min-h-[44px]">Get Started</button>
            </main>
          </body>
        </html>
      `;

      const cleanResult = analyzeDocumentUX(cleanHtml, { revision: 3 });
      expect(cleanResult.score).toBe(100);
      expect(cleanResult.severityCounts.critical).toBe(0);
      expect(cleanResult.severityCounts.warning).toBe(0);
      expect(cleanResult.documentRevision).toBe(3);

      // Defective HTML
      const badHtml = `
        <!DOCTYPE html>
        <html>
          <body>
            <div>
              <!-- Missing h1 (-15) -->
              <!-- Missing main (-6) -->
              <!-- Image without alt (-6) -->
              <img src="/test.jpg">
              <!-- Button without accessible name (-15) -->
              <button class="w-6 h-6"></button> <!-- Also small touch target (-6) -->
              <!-- Overflow at 390px (-15) -->
              <div style="width: 600px;">Wide</div>
              <!-- No visible CTA (-6) -->
            </div>
          </body>
        </html>
      `;

      const badResult = analyzeDocumentUX(badHtml, { revision: 5 });
      expect(badResult.score).toBeLessThan(50);
      expect(badResult.documentRevision).toBe(5);
      expect(badResult.severityCounts.critical).toBeGreaterThan(0);
      expect(badResult.severityCounts.warning).toBeGreaterThan(0);
    });
  });
});

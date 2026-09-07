import { JSDOM } from "jsdom";
import { PageGenerationProvider } from "./provider";
import { PageGenerationRequest, PageGenerationResult } from "./schemas";
import { buildNormalizedContext } from "./source-precedence";
import { sanitizeGeneratedHtml } from "./sanitizer";

function applyMockOptimizations(
  baseHtml: string,
  instruction: string
): { html: string; addressedTitles: string[] } {
  const dom = new JSDOM(baseHtml);
  const doc = dom.window.document;
  const lower = instruction.toLowerCase();
  const addressedTitles: string[] = [];

  // 1. Image alt
  if (lower.includes("img-alt") || lower.includes("image") || lower.includes("alt")) {
    const images = doc.querySelectorAll("img:not([alt]), img[alt='']");
    if (images.length > 0) {
      images.forEach((img, idx) => {
        img.setAttribute("alt", `Optimized visual graphic ${idx + 1}`);
      });
      addressedTitles.push("Images without alt attribute");
    }
  }

  // 2. Accessible names
  if (
    lower.includes("accessible-name") ||
    lower.includes("accessible name") ||
    lower.includes("interactive")
  ) {
    const buttons = doc.querySelectorAll("button, a, [role='button'], [role='link']");
    let fixed = false;
    buttons.forEach((el) => {
      const hasText = !!el.textContent?.trim();
      const hasAria =
        !!el.getAttribute("aria-label") ||
        !!el.getAttribute("aria-labelledby") ||
        !!el.getAttribute("title");
      if (!hasText && !hasAria) {
        el.setAttribute("aria-label", "Interactive action");
        fixed = true;
      }
    });
    if (fixed) {
      addressedTitles.push("Interactive elements without accessible name");
    }
  }

  // 3. Heading h1
  if (lower.includes("heading-h1") || lower.includes("<h1>") || lower.includes("heading")) {
    const h1s = doc.querySelectorAll("h1");
    if (h1s.length === 0) {
      const firstHeading = doc.querySelector("h2, h3, h4, h5, h6");
      if (firstHeading) {
        const h1 = doc.createElement("h1");
        h1.className = firstHeading.className;
        h1.innerHTML = firstHeading.innerHTML;
        for (const attr of Array.from(firstHeading.attributes)) {
          h1.setAttribute(attr.name, attr.value);
        }
        firstHeading.replaceWith(h1);
      } else {
        const body = doc.body;
        const h1 = doc.createElement("h1");
        h1.className = "text-4xl font-extrabold tracking-tight mb-4";
        h1.textContent = "Optimized Page";
        body.insertBefore(h1, body.firstChild);
      }
      addressedTitles.push("Missing or multiple <h1> headings");
    } else if (h1s.length > 1) {
      for (let i = 1; i < h1s.length; i++) {
        const h2 = doc.createElement("h2");
        h2.className = h1s[i].className;
        h2.innerHTML = h1s[i].innerHTML;
        for (const attr of Array.from(h1s[i].attributes)) {
          h2.setAttribute(attr.name, attr.value);
        }
        h1s[i].replaceWith(h2);
      }
      addressedTitles.push("Missing or multiple <h1> headings");
    }
  }

  // 4. Heading levels
  if (lower.includes("heading-levels") || lower.includes("hierarchy")) {
    const h3s = doc.querySelectorAll("h3");
    h3s.forEach((h3) => {
      const h2 = doc.createElement("h2");
      h2.className = h3.className;
      h2.innerHTML = h3.innerHTML;
      for (const attr of Array.from(h3.attributes)) {
        h2.setAttribute(attr.name, attr.value);
      }
      h3.replaceWith(h2);
    });
    addressedTitles.push("Skipped heading hierarchy");
  }

  // 5. Missing main
  if (lower.includes("missing-main") || lower.includes("<main>") || lower.includes("landmark")) {
    if (!doc.querySelector("main") && !doc.querySelector("[role='main']")) {
      const main = doc.createElement("main");
      const bodyChildren = Array.from(doc.body.children);
      const header = bodyChildren.find((c) => c.tagName.toLowerCase() === "header");
      const footer = bodyChildren.find((c) => c.tagName.toLowerCase() === "footer");
      const targetChildren = bodyChildren.filter(
        (c) => c !== header && c !== footer && c.tagName.toLowerCase() !== "script"
      );

      if (targetChildren.length > 0) {
        targetChildren[0].before(main);
        targetChildren.forEach((c) => main.appendChild(c));
      } else {
        doc.body.appendChild(main);
      }
      addressedTitles.push("Missing <main> landmark");
    }
  }

  // 6. Mobile overflow at 390px
  if (lower.includes("mobile-overflow") || lower.includes("390px") || lower.includes("overflow")) {
    const fixedWidthElements = doc.querySelectorAll("[class*='w-['], [class*='min-w-[']");
    fixedWidthElements.forEach((el) => {
      let cls = el.getAttribute("class") || "";
      cls = cls.replace(/w-\[\d+px\]/g, "max-w-full w-full").replace(/min-w-\[\d+px\]/g, "min-w-0");
      el.setAttribute("class", cls);
    });
    addressedTitles.push("Potential mobile layout overflow at 390px");
  }

  // 7. Touch target
  if (lower.includes("touch-target") || lower.includes("touch target") || lower.includes("44")) {
    const smallTargets = doc.querySelectorAll("button, a");
    smallTargets.forEach((el) => {
      const cls = el.getAttribute("class") || "";
      if (!cls.includes("min-h-[44px]") && !cls.includes("h-11") && !cls.includes("h-12")) {
        el.setAttribute(
          "class",
          `${cls} min-h-[44px] min-w-[44px] inline-flex items-center justify-center`.trim()
        );
      }
    });
    addressedTitles.push("Touch target likely smaller than 44x44 px");
  }

  // 8. CTA heuristic
  if (lower.includes("cta") || lower.includes("call-to-action") || lower.includes("conversion")) {
    const ctas = doc.querySelectorAll("a, button");
    let found = false;
    ctas.forEach((el) => {
      const txt = el.textContent?.toLowerCase() || "";
      if (
        txt.includes("get started") ||
        txt.includes("start") ||
        txt.includes("try") ||
        txt.includes("sign up")
      ) {
        let cls = el.getAttribute("class") || "";
        if (!cls.includes("bg-")) {
          cls += " bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md px-5 py-2.5 rounded-xl";
          el.setAttribute("class", cls.trim());
          found = true;
        }
      }
    });
    if (!found && doc.body) {
      const newCta = doc.createElement("a");
      newCta.setAttribute("href", "#get-started");
      newCta.setAttribute(
        "class",
        "inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md"
      );
      newCta.textContent = "Get Started Today";
      doc.body.appendChild(newCta);
    }
    addressedTitles.push("No prominent call-to-action (CTA) detected");
  }

  const html = doc.documentElement ? doc.documentElement.outerHTML : doc.body.outerHTML;
  return {
    html: `<!DOCTYPE html>\n${html}`,
    addressedTitles: Array.from(new Set(addressedTitles)),
  };
}

export class MockPageGenerationProvider implements PageGenerationProvider {
  async generate(
    request: PageGenerationRequest,
    options: {
      signal?: AbortSignal;
      onProgress?: (stage: string) => void;
    } = {}
  ): Promise<PageGenerationResult> {
    const { onProgress, signal } = options;

    if (signal?.aborted) {
      throw new DOMException("Generation aborted", "AbortError");
    }

    onProgress?.("Preparing context");
    await new Promise((r) => setTimeout(r, 40));

    // Check if this is a surgical optimization request on current document
    const isOptimization =
      request.scope === "new_version" &&
      !!request.context.currentDocument?.html &&
      (request.instruction.toLowerCase().includes("ux finding") ||
        request.instruction.toLowerCase().includes("resolve the following") ||
        (request.context.currentDocument.outline &&
          request.context.currentDocument.outline.length > 0));

    if (isOptimization && request.context.currentDocument?.html) {
      onProgress?.("Analyzing selected findings");
      await new Promise((r) => setTimeout(r, 40));

      if (signal?.aborted) {
        throw new DOMException("Generation aborted", "AbortError");
      }

      onProgress?.("Generating optimization");
      const { html: optimizedRaw, addressedTitles } = applyMockOptimizations(
        request.context.currentDocument.html,
        request.instruction
      );
      await new Promise((r) => setTimeout(r, 40));

      onProgress?.("Validating HTML");
      const sanitized = sanitizeGeneratedHtml(optimizedRaw);

      onProgress?.("Preparing preview");
      await new Promise((r) => setTimeout(r, 40));

      const summary =
        addressedTitles.length > 0
          ? `Addressed ${addressedTitles.length} UX finding${addressedTitles.length > 1 ? "s" : ""}: ${addressedTitles.join("; ")}`
          : `Addressed selected UX findings on document revision ${request.basedOnRevision}`;

      return {
        id: `gen_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        requestId: request.requestId,
        conversationId: request.conversationId,
        basedOnRevision: request.basedOnRevision,
        scope: request.scope,
        summary,
        html: sanitized.sanitizedHtml,
        warnings: [],
        attachmentIds: request.attachmentIds,
        sourcePrecedence: {
          sources: [
            { sourceId: "current-doc", role: "current-document" },
            { sourceId: "user-goal", role: "user-goal" },
          ],
          conflicts: [],
        },
        validation: {
          valid: sanitized.isValid,
          diagnostics: sanitized.diagnostics,
        },
        createdAt: new Date().toISOString(),
      };
    }

    onProgress?.("Reading attachments");
    const normalized = buildNormalizedContext(request);
    await new Promise((r) => setTimeout(r, 40));

    if (signal?.aborted) {
      throw new DOMException("Generation aborted", "AbortError");
    }

    onProgress?.("Building page structure");
    await new Promise((r) => setTimeout(r, 40));

    // Extract visual theme values from tokens if present
    const primaryColor =
      normalized.designTokensReference?.colors?.primary?.value || "rgb(37, 99, 235)";
    const bgColor =
      normalized.designTokensReference?.colors?.background?.value || "rgb(255, 255, 255)";
    const textColor =
      normalized.designTokensReference?.colors?.textPrimary?.value || "rgb(15, 23, 42)";

    const headline = normalized.cleanInstruction
      ? `Transform Your Experience: ${normalized.cleanInstruction.slice(0, 40)}`
      : "Build Faster with Modern Web Architecture";

    onProgress?.("Generating implementation");

    const rawTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generated Landing Page</title>
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
</head>
<body class="min-h-screen font-sans antialiased selection:bg-blue-500 selection:text-white" style="background-color: ${bgColor}; color: ${textColor};">
  <!-- Header -->
  <header class="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
    <div class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-lg" style="background-color: ${primaryColor};">P</div>
        <span class="font-bold text-lg tracking-tight text-slate-900">ProofUI</span>
      </div>
      <nav class="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
        <a href="#features" class="hover:text-blue-600 transition-colors">Features</a>
        <a href="#testimonials" class="hover:text-blue-600 transition-colors">Testimonials</a>
        <a href="#pricing" class="hover:text-blue-600 transition-colors">Pricing</a>
      </nav>
      <div class="flex items-center gap-3">
        <a href="#cta" class="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all hover:shadow-md">Get Started</a>
      </div>
    </div>
  </header>

  <!-- Hero Section -->
  <main>
    <section class="relative pt-20 pb-24 overflow-hidden border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white">
      <div class="max-w-5xl mx-auto px-6 text-center">
        <div class="inline-flex items-center gap-2 px-3 py-1 mb-6 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200/60 rounded-full">
          <span>✨ New Release</span>
          <span class="text-blue-400">•</span>
          <span>Deterministic Page Generation</span>
        </div>
        <h1 class="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.15] mb-6">
          ${headline}
        </h1>
        <p class="max-w-2xl mx-auto text-lg md:text-xl text-slate-600 leading-relaxed mb-10">
          Supercharge your visual development workflow with deep structural extraction, resilient Tailwind styling, and atomic change control.
        </p>
        <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a href="#cta" class="w-full sm:w-auto px-7 py-3.5 text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md hover:shadow-lg transition-all">Start Free Trial</a>
          <a href="#features" class="w-full sm:w-auto px-7 py-3.5 text-base font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-sm transition-all">Explore Platform</a>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section id="features" class="py-24 bg-white border-b border-slate-100">
      <div class="max-w-7xl mx-auto px-6">
        <div class="text-center max-w-3xl mx-auto mb-16">
          <h2 class="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 mb-4">Engineered for Precision</h2>
          <p class="text-base md:text-lg text-slate-600">Everything you need to capture, inspect, and mutate web documents with absolute confidence.</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div class="p-8 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:shadow-xl transition-all">
            <div class="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xl mb-6">1</div>
            <h3 class="text-xl font-semibold text-slate-900 mb-2">Isolated Extraction</h3>
            <p class="text-slate-600 text-sm leading-relaxed">Headless browser capture cleans tracking and extracts typography, colors, and layout metrics safely.</p>
          </div>
          <div class="p-8 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:shadow-xl transition-all">
            <div class="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xl mb-6">2</div>
            <h3 class="text-xl font-semibold text-slate-900 mb-2">Deterministic Tokens</h3>
            <p class="text-slate-600 text-sm leading-relaxed">Derives harmonic color palettes, font weights, and spacing grids from real computed DOM styles.</p>
          </div>
          <div class="p-8 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:shadow-xl transition-all">
            <div class="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xl mb-6">3</div>
            <h3 class="text-xl font-semibold text-slate-900 mb-2">Atomic Version Control</h3>
            <p class="text-slate-600 text-sm leading-relaxed">Preview candidate generations in an isolated sandbox, review diffs, and apply with single-step undo.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Social Proof / Stats -->
    <section id="testimonials" class="py-16 bg-slate-900 text-white">
      <div class="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
        <div>
          <div class="text-4xl font-extrabold text-blue-400 mb-1">99.9%</div>
          <div class="text-sm text-slate-400">Capture Accuracy</div>
        </div>
        <div>
          <div class="text-4xl font-extrabold text-blue-400 mb-1">&lt; 1.5s</div>
          <div class="text-sm text-slate-400">Extraction Speed</div>
        </div>
        <div>
          <div class="text-4xl font-extrabold text-blue-400 mb-1">100%</div>
          <div class="text-sm text-slate-400">Client Script Defense</div>
        </div>
        <div>
          <div class="text-4xl font-extrabold text-blue-400 mb-1">0 Overwrite</div>
          <div class="text-sm text-slate-400">Safe Candidate Preview</div>
        </div>
      </div>
    </section>

    <!-- Call to Action -->
    <section id="cta" class="py-24 bg-blue-600 text-white text-center">
      <div class="max-w-4xl mx-auto px-6">
        <h2 class="text-4xl md:text-5xl font-extrabold tracking-tight mb-6">Ready to Build With ProofUI?</h2>
        <p class="text-lg md:text-xl text-blue-100 mb-10 max-w-2xl mx-auto">Import any website, extract design tokens, and generate responsive landing pages in seconds.</p>
        <a href="#features" class="inline-block px-8 py-4 text-base font-semibold text-blue-700 bg-white hover:bg-blue-50 rounded-xl shadow-lg hover:shadow-xl transition-all">Get Started Free</a>
      </div>
    </section>
  </main>

  <!-- Footer -->
  <footer class="py-12 border-t border-slate-200 bg-slate-50 text-slate-500 text-sm">
    <div class="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
      <div class="flex items-center gap-2">
        <div class="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-white font-bold text-xs">P</div>
        <span class="font-semibold text-slate-700">ProofUI</span>
      </div>
      <p>© 2026 ProofUI Engine. All rights reserved. Generated deterministically.</p>
    </div>
  </footer>
</body>
</html>`;

    onProgress?.("Validating HTML");
    const sanitized = sanitizeGeneratedHtml(rawTemplate);

    onProgress?.("Preparing preview");
    await new Promise((r) => setTimeout(r, 40));

    const warnings: string[] = [];
    if (request.context.screenshotReference) {
      warnings.push(
        "Multimodal visual OCR requires a production multimodal model. Using extracted tokens and structure heuristics."
      );
    }

    onProgress?.("Ready for review");

    return {
      id: `gen_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      requestId: request.requestId,
      conversationId: request.conversationId,
      basedOnRevision: request.basedOnRevision,
      scope: request.scope,
      summary: `Generated full-page landing page (${headline})`,
      html: sanitized.sanitizedHtml,
      warnings,
      attachmentIds: request.attachmentIds,
      sourcePrecedence: normalized.sourcePrecedence,
      validation: {
        valid: sanitized.isValid,
        diagnostics: sanitized.diagnostics,
      },
      createdAt: new Date().toISOString(),
    };
  }
}

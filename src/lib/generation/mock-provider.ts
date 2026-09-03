import { PageGenerationProvider } from "./provider";
import { PageGenerationRequest, PageGenerationResult } from "./schemas";
import { buildNormalizedContext } from "./source-precedence";
import { sanitizeGeneratedHtml } from "./sanitizer";

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

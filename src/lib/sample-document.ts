import { getInjectedBridgeScript } from "./bridge/injected-bridge";

/**
 * Returns a complete standalone HTML document string containing a modern
 * Tailwind CSS landing page and the injected Editor Bridge script.
 */
export function getSampleTailwindDocument(sessionId = "default-session"): string {
  const bridgeScript = getInjectedBridgeScript(sessionId);

  return `<!DOCTYPE html>
<html lang="en" class="h-full">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Apex SaaS - Modern Cloud Architecture</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            brand: {
              50: '#eef2ff',
              100: '#e0e7ff',
              500: '#6366f1',
              600: '#4f46e5',
              700: '#4338ca',
            }
          }
        }
      }
    }
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      user-select: none; /* Prevent accidental text selection when clicking to select */
    }
    /* Visual editor cursor helpers */
    [data-editor-id] {
      cursor: default;
    }
    a, button {
      cursor: pointer;
    }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-full flex flex-col selection:bg-indigo-500 selection:text-white" data-editor-id="body-root">

  <!-- Navigation Header -->
  <header class="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur sticky top-0 z-20" data-editor-id="header-nav">
    <div class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between" data-editor-id="header-container">
      <div class="flex items-center gap-3" data-editor-id="logo-wrap">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25" data-editor-id="logo-icon">
          <span class="font-extrabold text-white text-lg" data-editor-id="logo-text-sym">▲</span>
        </div>
        <span class="font-bold text-xl tracking-tight text-white" data-editor-id="logo-brand-name">Apex Cloud</span>
      </div>

      <nav class="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300" data-editor-id="main-nav">
        <a href="#features" class="hover:text-white transition-colors" data-editor-id="nav-link-features">Features</a>
        <a href="#solutions" class="hover:text-white transition-colors" data-editor-id="nav-link-solutions">Solutions</a>
        <a href="#pricing" class="hover:text-white transition-colors" data-editor-id="nav-link-pricing">Pricing</a>
        <a href="#docs" class="hover:text-white transition-colors" data-editor-id="nav-link-docs">Documentation</a>
      </nav>

      <div class="flex items-center gap-4" data-editor-id="header-actions">
        <button class="text-sm font-medium text-slate-300 hover:text-white px-3 py-2 transition-colors" data-editor-id="btn-login">Sign In</button>
        <button class="text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg shadow-sm shadow-indigo-600/30 transition-all hover:scale-[1.02]" data-editor-id="btn-get-started">Get Started</button>
      </div>
    </div>
  </header>

  <!-- Hero Section -->
  <main class="flex-1" data-editor-id="main-content">
    <section class="relative pt-20 pb-24 overflow-hidden" data-editor-id="hero-section">
      <!-- Glow background decoration -->
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-indigo-600/15 blur-[120px] rounded-full pointer-events-none" data-editor-id="hero-glow"></div>

      <div class="max-w-5xl mx-auto px-6 text-center relative z-10" data-editor-id="hero-container">
        <!-- Release Badge -->
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-semibold mb-8 hover:bg-indigo-500/15 transition-colors" data-editor-id="hero-badge">
          <span class="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" data-editor-id="badge-dot"></span>
          <span data-editor-id="badge-text">Next-Gen Architecture Engine 3.0</span>
        </div>

        <!-- Headline -->
        <h1 class="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight" data-editor-id="hero-title">
          Scale your infrastructure with <span class="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-sky-400" data-editor-id="hero-gradient-text">effortless precision</span>
        </h1>

        <!-- Subtitle -->
        <p class="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed" data-editor-id="hero-subtitle">
          Deploy multi-region cloud services in seconds. Automated orchestration, zero-downtime rollouts, and deep observability baked right in.
        </p>

        <!-- CTA Buttons -->
        <div class="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16" data-editor-id="hero-cta-group">
          <button class="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-xl shadow-indigo-600/25 transition-all hover:scale-[1.02]" data-editor-id="hero-primary-cta">
            Start Free 14-Day Trial
          </button>
          <button class="w-full sm:w-auto px-8 py-3.5 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900/60 hover:bg-slate-900 text-slate-300 font-semibold text-sm transition-all" data-editor-id="hero-secondary-cta">
            View Live Sandbox
          </button>
        </div>

        <!-- Metric Stat Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t border-slate-800/80 text-left" data-editor-id="hero-metrics-grid">
          <div class="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/60" data-editor-id="metric-card-1">
            <div class="text-3xl font-bold text-white mb-1" data-editor-id="metric-num-1">99.999%</div>
            <div class="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1" data-editor-id="metric-label-1">Guaranteed SLA</div>
            <div class="text-xs text-slate-400" data-editor-id="metric-desc-1">Enterprise multi-region failover protection.</div>
          </div>
          <div class="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/60" data-editor-id="metric-card-2">
            <div class="text-3xl font-bold text-indigo-400 mb-1" data-editor-id="metric-num-2">&lt; 15ms</div>
            <div class="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1" data-editor-id="metric-label-2">Edge Routing Latency</div>
            <div class="text-xs text-slate-400" data-editor-id="metric-desc-2">Distributed globally across 140+ points of presence.</div>
          </div>
          <div class="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/60" data-editor-id="metric-card-3">
            <div class="text-3xl font-bold text-white mb-1" data-editor-id="metric-num-3">4.2M+</div>
            <div class="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1" data-editor-id="metric-label-3">Requests / Sec</div>
            <div class="text-xs text-slate-400" data-editor-id="metric-desc-3">Handling peak global surges without dropped packets.</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section class="py-20 border-t border-slate-800/60 bg-slate-950/60" data-editor-id="features-section">
      <div class="max-w-7xl mx-auto px-6" data-editor-id="features-container">
        <div class="max-w-2xl mb-14" data-editor-id="features-header">
          <h2 class="text-xs uppercase font-bold tracking-widest text-indigo-400 mb-2" data-editor-id="features-tagline">Engineered for Devs</h2>
          <h3 class="text-3xl font-bold text-white tracking-tight" data-editor-id="features-title">Everything you need to ship in minutes</h3>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-8" data-editor-id="features-grid">
          <div class="p-8 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-indigo-500/40 transition-colors group" data-editor-id="feature-card-1">
            <div class="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-lg mb-6 group-hover:bg-indigo-500/20 transition-colors" data-editor-id="feature-icon-1">⚡</div>
            <h4 class="text-lg font-bold text-white mb-3" data-editor-id="feature-title-1">Instant Cold Starts</h4>
            <p class="text-sm text-slate-400 leading-relaxed" data-editor-id="feature-desc-1">Microsecond VM boots and warm pool management ensure your functions never stall user interactions.</p>
          </div>

          <div class="p-8 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-indigo-500/40 transition-colors group" data-editor-id="feature-card-2">
            <div class="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center font-bold text-lg mb-6 group-hover:bg-violet-500/20 transition-colors" data-editor-id="feature-icon-2">🛡️</div>
            <h4 class="text-lg font-bold text-white mb-3" data-editor-id="feature-title-2">Zero-Trust Isolation</h4>
            <p class="text-sm text-slate-400 leading-relaxed" data-editor-id="feature-desc-2">Hardware-level sandbox virtualization protects tenant data and completely shields internal pipelines.</p>
          </div>

          <div class="p-8 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-indigo-500/40 transition-colors group" data-editor-id="feature-card-3">
            <div class="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-lg mb-6 group-hover:bg-sky-500/20 transition-colors" data-editor-id="feature-icon-3">📊</div>
            <h4 class="text-lg font-bold text-white mb-3" data-editor-id="feature-title-3">Real-time Metrics</h4>
            <p class="text-sm text-slate-400 leading-relaxed" data-editor-id="feature-desc-3">Sub-second telemetry streams directly into your command-line dashboard or third-party monitoring stack.</p>
          </div>
        </div>
      </div>
    </section>
  </main>

  <!-- Footer -->
  <footer class="border-t border-slate-800/80 bg-slate-950 py-12" data-editor-id="footer-root">
    <div class="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6" data-editor-id="footer-container">
      <div class="text-sm text-slate-500" data-editor-id="footer-copyright">
        &copy; 2026 Apex Cloud Inc. All rights reserved.
      </div>
      <div class="flex items-center gap-6 text-sm text-slate-400" data-editor-id="footer-links">
        <a href="#terms" class="hover:text-white transition-colors" data-editor-id="footer-link-terms">Terms of Service</a>
        <a href="#privacy" class="hover:text-white transition-colors" data-editor-id="footer-link-privacy">Privacy Notice</a>
        <a href="#status" class="hover:text-white transition-colors" data-editor-id="footer-link-status">System Status</a>
      </div>
    </div>
  </footer>

  <!-- Editor Bridge Injected Script -->
  <script>
${bridgeScript}
  </script>
</body>
</html>`;
}

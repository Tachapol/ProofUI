import { PROOFUI_TRACKER_VERSION } from "./schemas";

export interface GenerateTrackerOptions {
  projectId: string;
  pageId: string;
  versionId: string;
  endpointUrl?: string;
}

/**
 * Generates the ProofUI first-party lightweight tracking script.
 * App-owned and versioned.
 * Collects strictly non-PII, privacy-safe interaction metrics.
 */
export function generateProductionTrackerScript(options: GenerateTrackerOptions): string {
  const { projectId, pageId, versionId, endpointUrl = "/api/production/telemetry" } = options;

  // Safe JSON serialization of configuration
  const config = JSON.stringify({
    projectId,
    pageId,
    versionId,
    endpointUrl,
    version: PROOFUI_TRACKER_VERSION,
  });

  return `
<!-- ProofUI First-Party Privacy-Safe Telemetry (v${PROOFUI_TRACKER_VERSION}) -->
<script data-proofui-tracker="v${PROOFUI_TRACKER_VERSION}">
(function() {
  'use strict';
  var config = ${config};
  var startTime = Date.now();
  var sessionId = 's_' + Math.random().toString(36).slice(2, 11) + '_' + Date.now().toString(36);
  
  // Viewport category detection
  function getViewportCategory() {
    var width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth || 1024;
    if (width < 640) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  // Duration bucket calculation
  function getDurationBucket(durationMs) {
    var sec = durationMs / 1000;
    if (sec < 15) return '<15s';
    if (sec < 30) return '15-30s';
    if (sec < 60) return '30-60s';
    if (sec < 180) return '1-3m';
    return '>3m';
  }

  // Scroll depth tracking
  var scrollDepth = {
    reached25: false,
    reached50: false,
    reached75: false,
    reached100: false
  };

  function checkScrollDepth() {
    var winHeight = window.innerHeight || document.documentElement.clientHeight || 1;
    var docHeight = Math.max(
      document.body.scrollHeight || 0,
      document.documentElement.scrollHeight || 0,
      winHeight
    );
    var scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    var maxScroll = docHeight - winHeight;
    if (maxScroll <= 0) {
      scrollDepth.reached25 = true;
      scrollDepth.reached50 = true;
      scrollDepth.reached75 = true;
      scrollDepth.reached100 = true;
      return;
    }
    var scrollRatio = (scrollTop / maxScroll) * 100;
    if (scrollRatio >= 25) scrollDepth.reached25 = true;
    if (scrollRatio >= 50) scrollDepth.reached50 = true;
    if (scrollRatio >= 75) scrollDepth.reached75 = true;
    if (scrollRatio >= 99) scrollDepth.reached100 = true;
  }

  window.addEventListener('scroll', checkScrollDepth, { passive: true });
  // Check initial scroll
  checkScrollDepth();

  // Click tracking by data-editor-id ONLY
  var ctaClicks = {};
  var elementClicks = {};
  var ctaKeywords = /\\b(get started|sign up|start free|try free|join now|buy now|subscribe|download|cta|btn-primary)\\b/i;

  document.addEventListener('click', function(event) {
    var target = event.target;
    if (!target) return;

    // Traverse up to find closest element with data-editor-id
    var current = target;
    var editorId = null;
    var isCta = false;

    while (current && current !== document.body && current !== document.documentElement) {
      if (!editorId && current.getAttribute) {
        var idAttr = current.getAttribute('data-editor-id');
        if (idAttr) editorId = idAttr;
      }
      var tag = (current.tagName || '').toLowerCase();
      var cls = current.className && typeof current.className === 'string' ? current.className : '';
      var text = (current.innerText || current.textContent || '').slice(0, 50);
      if (tag === 'button' || tag === 'a' || ctaKeywords.test(cls) || ctaKeywords.test(text)) {
        isCta = true;
      }
      current = current.parentElement;
    }

    if (editorId) {
      elementClicks[editorId] = (elementClicks[editorId] || 0) + 1;
      if (isCta) {
        ctaClicks[editorId] = (ctaClicks[editorId] || 0) + 1;
      }
    }
  }, { capture: true, passive: true });

  var dispatched = false;
  function sendTelemetry() {
    if (dispatched) return;
    dispatched = true;

    checkScrollDepth();
    var durationMs = Date.now() - startTime;
    var payload = {
      projectId: config.projectId,
      pageId: config.pageId,
      versionId: config.versionId,
      sessionId: sessionId,
      viewport: getViewportCategory(),
      sessionDurationBucket: getDurationBucket(durationMs),
      scrollDepth: scrollDepth,
      ctaClicks: ctaClicks,
      elementClicks: elementClicks,
      trackerVersion: config.version
    };

    var body = JSON.stringify(payload);

    if (navigator.sendBeacon) {
      try {
        var blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(config.endpointUrl, blob);
        return;
      } catch (e) {}
    }

    if (window.fetch) {
      try {
        fetch(config.endpointUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body,
          keepalive: true
        }).catch(function() {});
      } catch (e) {}
    }
  }

  window.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') sendTelemetry();
  });
  window.addEventListener('pagehide', sendTelemetry);
  window.addEventListener('beforeunload', sendTelemetry);
})();
</script>
`;
}

/**
 * Embeds metadata and tracking script into the HTML document.
 */
export function injectPublishedMetadataAndTracker(
  html: string,
  options: GenerateTrackerOptions & { trackingEnabled: boolean; title?: string }
): string {
  const { projectId, pageId, versionId, trackingEnabled } = options;

  const metaTags = `
  <meta name="proofui-project-id" content="${projectId}">
  <meta name="proofui-page-id" content="${pageId}">
  <meta name="proofui-version-id" content="${versionId}">
  <meta name="proofui-tracking-enabled" content="${trackingEnabled ? "true" : "false"}">
  `;

  let modifiedHtml = html;

  // Insert meta tags into <head> if exists, else prepend
  if (modifiedHtml.includes("</head>")) {
    modifiedHtml = modifiedHtml.replace("</head>", `${metaTags}\n</head>`);
  } else if (modifiedHtml.includes("<body")) {
    modifiedHtml = modifiedHtml.replace("<body", `<head>${metaTags}</head>\n<body`);
  } else {
    modifiedHtml = `<head>${metaTags}</head>\n${modifiedHtml}`;
  }

  // Insert tracking script before </body> if opt-in tracking is enabled
  if (trackingEnabled) {
    const trackerScript = generateProductionTrackerScript(options);
    if (modifiedHtml.includes("</body>")) {
      modifiedHtml = modifiedHtml.replace("</body>", `${trackerScript}\n</body>`);
    } else {
      modifiedHtml = `${modifiedHtml}\n${trackerScript}`;
    }
  }

  return modifiedHtml;
}

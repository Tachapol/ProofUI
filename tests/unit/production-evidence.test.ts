import { describe, it, expect, beforeEach } from "vitest";
import {
  PublishedMetadata,
  ProductionTelemetryPayloadSchema,
  FORBIDDEN_PAYLOAD_KEYS,
  PROOFUI_TRACKER_VERSION,
  MAX_PAYLOAD_SIZE_BYTES,
} from "@/lib/production/schemas";
import { ProductionStore } from "@/lib/production/store";
import { RateLimiter, isPayloadSizeValid } from "@/lib/production/rate-limiter";
import { injectPublishedMetadataAndTracker } from "@/lib/production/tracking-script";
import { analyzeDocumentUX } from "@/lib/optimization/ux-analyzer";

describe("Milestone 5.4: Production Evidence & Deploy", () => {
  let store: ProductionStore;

  const mockMetadata: PublishedMetadata = {
    projectId: "proj_alpha",
    pageId: "page_home",
    versionId: "ver_v1",
    publishedAt: new Date().toISOString(),
    title: "Alpha Landing Page",
    trackingEnabled: true,
    trackingVersion: PROOFUI_TRACKER_VERSION,
    endpointUrl: "/api/production/telemetry",
  };

  const sampleHtml = `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
  <h1>Welcome</h1>
  <button data-editor-id="btn-cta-1" class="btn-primary">Get Started</button>
  <button data-editor-id="btn-cta-2">Learn More</button>
</body>
</html>`;

  beforeEach(() => {
    store = new ProductionStore();
  });

  // ─── Test 1: Publish creates stable project/page/version metadata ─────────
  it("Test 1: Publish creates stable project/page/version metadata and embedded tags", () => {
    const injected = injectPublishedMetadataAndTracker(sampleHtml, {
      projectId: "proj_stable_123",
      pageId: "page_main_456",
      versionId: "ver_release_789",
      trackingEnabled: true,
    });

    // Check meta tags
    expect(injected).toContain('<meta name="proofui-project-id" content="proj_stable_123">');
    expect(injected).toContain('<meta name="proofui-page-id" content="page_main_456">');
    expect(injected).toContain('<meta name="proofui-version-id" content="ver_release_789">');
    expect(injected).toContain('<meta name="proofui-tracking-enabled" content="true">');

    // Check tracker script embedded
    expect(injected).toContain(`data-proofui-tracker="v${PROOFUI_TRACKER_VERSION}"`);
    expect(injected).toContain('"projectId":"proj_stable_123"');
    expect(injected).toContain('"pageId":"page_main_456"');
    expect(injected).toContain('"versionId":"ver_release_789"');

    // Check store registration
    store.publishVersion(mockMetadata, injected);
    expect(store.hasPublishedVersion("proj_alpha", "page_home", "ver_v1")).toBe(true);

    const record = store.getPublishedVersion("proj_alpha", "page_home", "ver_v1");
    expect(record).not.toBeNull();
    expect(record?.metadata.projectId).toBe("proj_alpha");
    expect(record?.metadata.versionId).toBe("ver_v1");
  });

  // ─── Test 2: Tracking payload rejects form values and unexpected fields ───
  it("Test 2: Tracking payload rejects form values, passwords, and unexpected fields via strict Zod schema", () => {
    const validPayload = {
      projectId: "proj_alpha",
      pageId: "page_home",
      versionId: "ver_v1",
      sessionId: "s_abc123",
      viewport: "desktop" as const,
      sessionDurationBucket: "15-30s" as const,
      scrollDepth: {
        reached25: true,
        reached50: true,
        reached75: false,
        reached100: false,
      },
      ctaClicks: { "btn-cta-1": 2 },
      elementClicks: { "btn-cta-1": 2 },
      trackerVersion: PROOFUI_TRACKER_VERSION,
    };

    // Valid payload passes
    const validParse = ProductionTelemetryPayloadSchema.safeParse(validPayload);
    expect(validParse.success).toBe(true);

    // Reject extraneous unexpected fields (.strict())
    const withUnexpectedField = {
      ...validPayload,
      unexpectedField: "malicious_injection",
    };
    const unexpectedParse = ProductionTelemetryPayloadSchema.safeParse(withUnexpectedField);
    expect(unexpectedParse.success).toBe(false);

    // Reject form values / passwords
    const withFormValue = {
      ...validPayload,
      formValue: "user_input_here",
    };
    expect(ProductionTelemetryPayloadSchema.safeParse(withFormValue).success).toBe(false);

    const withPassword = {
      ...validPayload,
      password: "secret_password",
    };
    expect(ProductionTelemetryPayloadSchema.safeParse(withPassword).success).toBe(false);

    // Check FORBIDDEN_PAYLOAD_KEYS contains critical keys
    expect(FORBIDDEN_PAYLOAD_KEYS.has("password")).toBe(true);
    expect(FORBIDDEN_PAYLOAD_KEYS.has("formValue")).toBe(true);
    expect(FORBIDDEN_PAYLOAD_KEYS.has("formData")).toBe(true);
    expect(FORBIDDEN_PAYLOAD_KEYS.has("cookie")).toBe(true);
    expect(FORBIDDEN_PAYLOAD_KEYS.has("ip")).toBe(true);
  });

  // ─── Test 3: Invalid project/version is rejected ──────────────────────────
  it("Test 3: Invalid or arbitrary project/version is rejected by store", () => {
    store.publishVersion(mockMetadata, sampleHtml);

    // Valid telemetry for registered version
    const validSuccess = store.recordTelemetry({
      projectId: "proj_alpha",
      pageId: "page_home",
      versionId: "ver_v1",
      sessionId: "s_1",
      viewport: "desktop",
      sessionDurationBucket: "<15s",
      scrollDepth: { reached25: true, reached50: false, reached75: false, reached100: false },
      ctaClicks: {},
      elementClicks: {},
      trackerVersion: PROOFUI_TRACKER_VERSION,
    });
    expect(validSuccess).toBe(true);

    // Unregistered / arbitrary project ID
    const arbitraryProject = store.recordTelemetry({
      projectId: "proj_arbitrary_fake",
      pageId: "page_home",
      versionId: "ver_v1",
      sessionId: "s_2",
      viewport: "desktop",
      sessionDurationBucket: "<15s",
      scrollDepth: { reached25: true, reached50: false, reached75: false, reached100: false },
      ctaClicks: {},
      elementClicks: {},
      trackerVersion: PROOFUI_TRACKER_VERSION,
    });
    expect(arbitraryProject).toBe(false);

    // Unregistered version
    const arbitraryVersion = store.recordTelemetry({
      projectId: "proj_alpha",
      pageId: "page_home",
      versionId: "ver_nonexistent",
      sessionId: "s_3",
      viewport: "desktop",
      sessionDurationBucket: "<15s",
      scrollDepth: { reached25: true, reached50: false, reached75: false, reached100: false },
      ctaClicks: {},
      elementClicks: {},
      trackerVersion: PROOFUI_TRACKER_VERSION,
    });
    expect(arbitraryVersion).toBe(false);
  });

  // ─── Test 4: Events are rate/size limited ─────────────────────────────────
  it("Test 4: Events are rate/size limited", () => {
    // 1. Rate limiter test: max 3 requests in small test instance
    const limiter = new RateLimiter(3, 10_000);
    const ip = "192.168.1.50";

    expect(limiter.check(ip).allowed).toBe(true);
    expect(limiter.check(ip).allowed).toBe(true);
    expect(limiter.check(ip).allowed).toBe(true);
    // 4th request must be rejected
    const blocked = limiter.check(ip);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);

    // 2. Size limit test
    expect(isPayloadSizeValid(1024)).toBe(true); // 1KB
    expect(isPayloadSizeValid(MAX_PAYLOAD_SIZE_BYTES)).toBe(true); // 32KB
    expect(isPayloadSizeValid(MAX_PAYLOAD_SIZE_BYTES + 1)).toBe(false); // 32KB + 1 byte
  });

  // ─── Test 5: Aggregation correctly counts scroll and CTA events ───────────
  it("Test 5: Aggregation correctly counts scroll thresholds, CTA clicks, and session duration buckets", () => {
    store.publishVersion(mockMetadata, sampleHtml);

    // Session 1: Desktop, scrolled to 100%, clicked cta-1 twice
    store.recordTelemetry({
      projectId: "proj_alpha",
      pageId: "page_home",
      versionId: "ver_v1",
      sessionId: "s_1",
      viewport: "desktop",
      sessionDurationBucket: "1-3m",
      scrollDepth: { reached25: true, reached50: true, reached75: true, reached100: true },
      ctaClicks: { "btn-cta-1": 2 },
      elementClicks: { "btn-cta-1": 2 },
      trackerVersion: PROOFUI_TRACKER_VERSION,
    });

    // Session 2: Mobile, scrolled to 50%, clicked cta-1 once and cta-2 once
    store.recordTelemetry({
      projectId: "proj_alpha",
      pageId: "page_home",
      versionId: "ver_v1",
      sessionId: "s_2",
      viewport: "mobile",
      sessionDurationBucket: "15-30s",
      scrollDepth: { reached25: true, reached50: true, reached75: false, reached100: false },
      ctaClicks: { "btn-cta-1": 1, "btn-cta-2": 1 },
      elementClicks: { "btn-cta-1": 1, "btn-cta-2": 1 },
      trackerVersion: PROOFUI_TRACKER_VERSION,
    });

    const evidence = store.getAggregatedEvidence("proj_alpha", "ver_v1");
    expect(evidence.length).toBe(1);

    const agg = evidence[0];
    expect(agg.totalSessions).toBe(2);
    expect(agg.viewportDistribution.desktop).toBe(1);
    expect(agg.viewportDistribution.mobile).toBe(1);

    // Scroll depth distribution
    expect(agg.scrollDepthDistribution.reached25).toBe(2);
    expect(agg.scrollDepthDistribution.reached50).toBe(2);
    expect(agg.scrollDepthDistribution.reached75).toBe(1);
    expect(agg.scrollDepthDistribution.reached100).toBe(1);

    // CTA Clicks
    expect(agg.ctaClickCounts["btn-cta-1"]).toBe(3);
    expect(agg.ctaClickCounts["btn-cta-2"]).toBe(1);

    // Duration buckets
    expect(agg.durationBuckets["1-3m"]).toBe(1);
    expect(agg.durationBuckets["15-30s"]).toBe(1);

    // Most clicked elements
    expect(agg.mostClickedElements[0].editorId).toBe("btn-cta-1");
    expect(agg.mostClickedElements[0].count).toBe(3);
  });

  // ─── Test 6: Dashboard filters evidence by version ────────────────────────
  it("Test 6: Store and dashboard query filters evidence strictly by version", () => {
    // Publish ver_v1
    store.publishVersion(
      { ...mockMetadata, versionId: "ver_v1" },
      sampleHtml
    );
    // Publish ver_v2
    store.publishVersion(
      { ...mockMetadata, versionId: "ver_v2" },
      sampleHtml
    );

    // Record 1 session on ver_v1
    store.recordTelemetry({
      projectId: "proj_alpha",
      pageId: "page_home",
      versionId: "ver_v1",
      sessionId: "s_v1_1",
      viewport: "desktop",
      sessionDurationBucket: "<15s",
      scrollDepth: { reached25: true, reached50: false, reached75: false, reached100: false },
      ctaClicks: { "btn-cta-1": 1 },
      elementClicks: {},
      trackerVersion: PROOFUI_TRACKER_VERSION,
    });

    // Record 2 sessions on ver_v2
    store.recordTelemetry({
      projectId: "proj_alpha",
      pageId: "page_home",
      versionId: "ver_v2",
      sessionId: "s_v2_1",
      viewport: "desktop",
      sessionDurationBucket: "1-3m",
      scrollDepth: { reached25: true, reached50: true, reached75: true, reached100: true },
      ctaClicks: { "btn-cta-1": 5 },
      elementClicks: {},
      trackerVersion: PROOFUI_TRACKER_VERSION,
    });
    store.recordTelemetry({
      projectId: "proj_alpha",
      pageId: "page_home",
      versionId: "ver_v2",
      sessionId: "s_v2_2",
      viewport: "mobile",
      sessionDurationBucket: ">3m",
      scrollDepth: { reached25: true, reached50: true, reached75: true, reached100: true },
      ctaClicks: { "btn-cta-1": 3 },
      elementClicks: {},
      trackerVersion: PROOFUI_TRACKER_VERSION,
    });

    // Query filter for ver_v1
    const v1Evidence = store.getAggregatedEvidence("proj_alpha", "ver_v1");
    expect(v1Evidence.length).toBe(1);
    expect(v1Evidence[0].versionId).toBe("ver_v1");
    expect(v1Evidence[0].totalSessions).toBe(1);
    expect(v1Evidence[0].ctaClickCounts["btn-cta-1"]).toBe(1);

    // Query filter for ver_v2
    const v2Evidence = store.getAggregatedEvidence("proj_alpha", "ver_v2");
    expect(v2Evidence.length).toBe(1);
    expect(v2Evidence[0].versionId).toBe("ver_v2");
    expect(v2Evidence[0].totalSessions).toBe(2);
    expect(v2Evidence[0].ctaClickCounts["btn-cta-1"]).toBe(8);

    // Query all versions for project
    const allEvidence = store.getAggregatedEvidence("proj_alpha");
    expect(allEvidence.length).toBe(2);
  });

  // ─── Test 7: Live evidence creates conversion findings ───────────────────
  it("Test 7: Live evidence creates actionable conversion findings in UX Analyzer", () => {
    // Construct mock evidence representing low CTA conversion and scroll drop-off
    const mockLiveEvidence = {
      projectId: "proj_alpha",
      pageId: "page_home",
      versionId: "ver_v1",
      totalSessions: 10,
      viewportDistribution: { desktop: 8, tablet: 1, mobile: 1 },
      durationBuckets: { "<15s": 6, "15-30s": 2, "30-60s": 1, "1-3m": 1, ">3m": 0 },
      scrollDepthDistribution: { reached25: 8, reached50: 4, reached75: 1, reached100: 0 },
      ctaClickCounts: { "btn-cta-1": 1 }, // Only 1 click out of 10 sessions (10% conversion)
      elementClickCounts: { "btn-cta-1": 1 },
      elementClicks: { "btn-cta-1": 1 },
      mostClickedElements: [{ editorId: "btn-cta-1", count: 1 }],
      lowInteractionImportantElements: [
        { editorId: "btn-cta-2", reason: "Element reached by users (>=75% scroll) but received 0 clicks across 10 sessions." },
      ],
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    };

    const analysis = analyzeDocumentUX(sampleHtml, {
      viewport: "desktop",
      revision: 1,
      liveEvidence: mockLiveEvidence,
    });

    // Check findings contain conversion findings
    const conversionFindings = analysis.findings.filter((f) => f.category === "conversion");
    expect(conversionFindings.length).toBeGreaterThan(0);

    // Finding 1: Low CTA conversion rate
    const ctaFinding = conversionFindings.find((f) =>
      f.title.includes("Low CTA conversion rate")
    );
    expect(ctaFinding).toBeDefined();
    expect(ctaFinding?.severity).toBe("warning");
    expect(ctaFinding?.evidence).toContain("10 session(s) with only 1 CTA click(s)");

    // Finding 2: High scroll drop-off (reached75: 1 vs reached25: 8)
    const scrollFinding = conversionFindings.find((f) =>
      f.title.includes("High scroll drop-off")
    );
    expect(scrollFinding).toBeDefined();

    // Finding 3: Zero interaction on important element
    const zeroFinding = conversionFindings.find((f) =>
      f.title.includes("Important element received zero interactions")
    );
    expect(zeroFinding).toBeDefined();
    expect(zeroFinding?.affectedNodeIds).toContain("btn-cta-2");

    // Finding 4: High bounce rate (<15s visits is 6 / 10 = 60%)
    const bounceFinding = conversionFindings.find((f) =>
      f.title.includes("High bounce rate")
    );
    expect(bounceFinding).toBeDefined();

    // Verify categoryCounts accurately tracks conversion issues
    expect(analysis.categoryCounts.conversion).toBe(conversionFindings.length);
  });

  // ─── Test 8: No secrets or user identifiers are returned to client ────────
  it("Test 8: No secrets, IP addresses, or user identifiers are returned to client", () => {
    store.publishVersion(mockMetadata, sampleHtml);
    store.recordTelemetry({
      projectId: "proj_alpha",
      pageId: "page_home",
      versionId: "ver_v1",
      sessionId: "s_temp_client_session",
      viewport: "desktop",
      sessionDurationBucket: "30-60s",
      scrollDepth: { reached25: true, reached50: true, reached75: true, reached100: false },
      ctaClicks: { "btn-cta-1": 1 },
      elementClicks: {},
      trackerVersion: PROOFUI_TRACKER_VERSION,
    });

    const evidenceList = store.getAggregatedEvidence("proj_alpha", "ver_v1");
    const jsonString = JSON.stringify(evidenceList);

    // Verify raw session IDs or client tokens are stripped
    expect(jsonString).not.toContain("s_temp_client_session");

    // Verify forbidden privacy keys do not exist in the output
    for (const forbidden of FORBIDDEN_PAYLOAD_KEYS) {
      expect(jsonString).not.toContain(`"${forbidden}"`);
    }

    // Check published metadata output
    const publishedList = store.getPublishedVersionsForProject("proj_alpha");
    const publishedJson = JSON.stringify(publishedList);
    expect(publishedJson).not.toContain("secret");
    expect(publishedJson).not.toContain("password");
  });
});

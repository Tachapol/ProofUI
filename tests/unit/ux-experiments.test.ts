import { describe, it, expect, beforeEach } from "vitest";
import { assignVariant } from "@/lib/experiment/schemas";
import { evaluateExperiment, RawVariantEvidence } from "@/lib/experiment/decisioning";
import { productionStore } from "@/lib/production/store";
import {
  ProductionTelemetryPayload,
  FORBIDDEN_PAYLOAD_KEYS,
  ProductionTelemetryPayloadSchema,
} from "@/lib/production/schemas";

describe("Milestone 5.5 — UX Experiments & Decisioning Unit Tests", () => {
  beforeEach(() => {
    productionStore.resetForTesting();
  });

  // ─── Test 1: Deterministic Traffic Assignment ──────────────────────────────
  it("Test 1: Variant assignment is deterministic and consistent", () => {
    const experimentId = "exp_hero_test_2026";
    const tokenA = "session_token_alice_123";
    const tokenB = "session_token_bob_456";

    // Same client token and experiment ID must return the exact same variant every single time
    const initialAssignmentA = assignVariant(experimentId, tokenA, 50);
    for (let i = 0; i < 50; i++) {
      expect(assignVariant(experimentId, tokenA, 50)).toBe(initialAssignmentA);
    }

    const initialAssignmentB = assignVariant(experimentId, tokenB, 50);
    for (let i = 0; i < 50; i++) {
      expect(assignVariant(experimentId, tokenB, 50)).toBe(initialAssignmentB);
    }

    // Hash distribution: over a sample of 200 distinct tokens, both control and variant are assigned
    const counts = { control: 0, variant: 0 };
    for (let i = 0; i < 200; i++) {
      const token = `visitor_sample_${i}_token`;
      const assigned = assignVariant(experimentId, token, 50);
      counts[assigned]++;
    }

    expect(counts.control).toBeGreaterThan(60);
    expect(counts.variant).toBeGreaterThan(60);
    expect(counts.control + counts.variant).toBe(200);

    // Empty or missing token safely falls back to control
    expect(assignVariant(experimentId, "", 50)).toBe("control");
  });

  // ─── Test 2: Event Aggregation is Isolated by Experiment & Variant ─────────
  it("Test 2: Event aggregation is strictly isolated by experiment and variant", () => {
    const projectId = "proj_test_isolation";
    const pageId = "page_home";
    const controlVer = "ver_ctrl_1";
    const variantVer = "ver_var_2";

    // Setup published versions
    productionStore.publishVersion(
      {
        projectId,
        pageId,
        versionId: controlVer,
        title: "Control Page",
        publishedAt: new Date().toISOString(),
        trackingEnabled: true,
        trackingVersion: "1.0.0",
        endpointUrl: "/api/production/telemetry",
      },
      "<html><body><button data-editor-id='cta-buy'>Buy</button></body></html>"
    );

    productionStore.publishVersion(
      {
        projectId,
        pageId,
        versionId: variantVer,
        title: "Variant Page",
        publishedAt: new Date().toISOString(),
        trackingEnabled: true,
        trackingVersion: "1.0.0",
        endpointUrl: "/api/production/telemetry",
      },
      "<html><body><button data-editor-id='cta-buy'>Order Now</button></body></html>"
    );

    const exp1 = productionStore.createExperiment({
      projectId,
      pageId,
      name: "Primary Experiment",
      controlVersionId: controlVer,
      variantVersionId: variantVer,
      goal: { type: "cta_click", targetCtaId: "cta-buy", thresholdScroll: 100 },
      minSampleSize: 20,
    });

    const exp2 = productionStore.createExperiment({
      projectId,
      pageId,
      name: "Secondary Experiment",
      controlVersionId: controlVer,
      variantVersionId: variantVer,
      goal: { type: "cta_click", targetCtaId: "cta-buy", thresholdScroll: 100 },
      minSampleSize: 20,
    });

    // Ingest telemetry ONLY for exp1 control
    productionStore.recordTelemetry({
      projectId,
      pageId,
      versionId: controlVer,
      sessionId: "s_c_1",
      viewport: "desktop",
      sessionDurationBucket: "30-60s",
      scrollDepth: { reached25: true, reached50: true, reached75: true, reached100: false },
      ctaClicks: { "cta-buy": 2 },
      elementClicks: { "cta-buy": 2 },
      trackerVersion: "1.0.0",
      experimentId: exp1.id,
      variantId: "control",
    });

    // Ingest telemetry ONLY for exp1 variant
    productionStore.recordTelemetry({
      projectId,
      pageId,
      versionId: variantVer,
      sessionId: "s_v_1",
      viewport: "mobile",
      sessionDurationBucket: ">3m",
      scrollDepth: { reached25: true, reached50: true, reached75: true, reached100: true },
      ctaClicks: { "cta-buy": 5 },
      elementClicks: { "cta-buy": 5 },
      trackerVersion: "1.0.0",
      experimentId: exp1.id,
      variantId: "variant",
    });

    const eval1 = productionStore.getExperimentEvaluation(exp1.id)!;
    const eval2 = productionStore.getExperimentEvaluation(exp2.id)!;

    // Verify exp1 metrics are isolated
    expect(eval1.control.sessions).toBe(1);
    expect(eval1.control.ctaClicks).toBe(2);
    expect(eval1.control.conversions).toBe(1);
    expect(eval1.variant.sessions).toBe(1);
    expect(eval1.variant.ctaClicks).toBe(5);
    expect(eval1.variant.conversions).toBe(1);

    // Verify exp2 has 0 sessions (completely isolated)
    expect(eval2.control.sessions).toBe(0);
    expect(eval2.variant.sessions).toBe(0);
  });

  // ─── Test 3: Insufficient-Data State Prevents Winner Recommendation ────────
  it("Test 3: Insufficient-data state prevents winner recommendation", () => {
    const experiment = {
      id: "exp_test_sample_size",
      projectId: "proj_1",
      pageId: "page_1",
      name: "Sample Size Test",
      controlVersionId: "ver_c",
      variantVersionId: "ver_v",
      status: "running" as const,
      goal: { type: "cta_click" as const, thresholdScroll: 100 as const },
      trafficSplit: 50,
      minSampleSize: 30, // 15 per variant required
      confidenceThreshold: 0.95,
      startedAt: new Date().toISOString(),
      endedAt: null,
      promotedVersionId: null,
    };

    // Control: 5 sessions (below minimum 15)
    const controlEvidence: RawVariantEvidence = {
      sessions: 5,
      ctaClicks: 1,
      scroll100Count: 2,
      goalConversions: 1,
    };

    // Variant: 5 sessions (below minimum 15) even with 100% conversion
    const variantEvidence: RawVariantEvidence = {
      sessions: 5,
      ctaClicks: 5,
      scroll100Count: 5,
      goalConversions: 5,
    };

    const result = evaluateExperiment(experiment, controlEvidence, variantEvidence);

    // Invariant: Must report insufficient data and refuse to recommend any winner
    expect(result.hasSufficientData).toBe(false);
    expect(result.sampleSizeMet).toBe(false);
    expect(result.winner).toBe("insufficient_data");
    expect(result.recommendedWinner).toBeNull();
    expect(result.recommendationSummary).toContain("Insufficient production data");
  });

  // ─── Test 4: Higher Conversion Produces Winner Recommendation ─────────────
  it("Test 4: Higher conversion with sufficient data produces winner recommendation with confidence", () => {
    const experiment = {
      id: "exp_stat_sig",
      projectId: "proj_1",
      pageId: "page_1",
      name: "High Lift Test",
      controlVersionId: "ver_control_stable",
      variantVersionId: "ver_variant_optimized",
      status: "running" as const,
      goal: { type: "cta_click" as const, thresholdScroll: 100 as const },
      trafficSplit: 50,
      minSampleSize: 20, // 10 per variant
      confidenceThreshold: 0.95,
      startedAt: new Date().toISOString(),
      endedAt: null,
      promotedVersionId: null,
    };

    // Control: 30 sessions, 2 conversions (6.7% conversion)
    const controlEvidence: RawVariantEvidence = {
      sessions: 30,
      ctaClicks: 2,
      scroll100Count: 10,
      goalConversions: 2,
    };

    // Variant: 30 sessions, 22 conversions (73.3% conversion)
    const variantEvidence: RawVariantEvidence = {
      sessions: 30,
      ctaClicks: 25,
      scroll100Count: 20,
      goalConversions: 22,
    };

    const result = evaluateExperiment(experiment, controlEvidence, variantEvidence);

    expect(result.hasSufficientData).toBe(true);
    expect(result.sampleSizeMet).toBe(true);
    expect(result.winner).toBe("variant");
    expect(result.recommendedWinner).toBe("ver_variant_optimized");
    expect(result.confidence).toBeGreaterThanOrEqual(0.95);
    expect(result.recommendationSummary).toContain("Variant won with 73.3% conversion");

    // Reverse scenario: Control significantly outperforms variant
    const controlWinsResult = evaluateExperiment(experiment, variantEvidence, controlEvidence);
    expect(controlWinsResult.winner).toBe("control");
    expect(controlWinsResult.recommendedWinner).toBe("ver_control_stable");
    expect(controlWinsResult.confidence).toBeGreaterThanOrEqual(0.95);
    expect(controlWinsResult.recommendationSummary).toContain("Control outperformed variant");
  });

  // ─── Test 5: Promote Winner Requires Explicit Confirmation ────────────────
  it("Test 5: Promote winner requires explicit confirmation and updates active published version", () => {
    const projectId = "proj_promote_test";
    const pageId = "page_home";
    const controlVer = "ver_ctrl_base";
    const variantVer = "ver_var_winner";

    productionStore.publishVersion(
      {
        projectId,
        pageId,
        versionId: controlVer,
        title: "Base Version",
        publishedAt: new Date().toISOString(),
        trackingEnabled: true,
        trackingVersion: "1.0.0",
        endpointUrl: "/api/production/telemetry",
      },
      "<html><body>Base</body></html>"
    );

    productionStore.publishVersion(
      {
        projectId,
        pageId,
        versionId: variantVer,
        title: "Winner Candidate",
        publishedAt: new Date().toISOString(),
        trackingEnabled: true,
        trackingVersion: "1.0.0",
        endpointUrl: "/api/production/telemetry",
      },
      "<html><body>Winner</body></html>"
    );

    const exp = productionStore.createExperiment({
      projectId,
      pageId,
      name: "Promotion Flow Test",
      controlVersionId: controlVer,
      variantVersionId: variantVer,
      goal: { type: "cta_click", thresholdScroll: 100 },
      minSampleSize: 20,
    });

    // Active version should initially be the latest published (variantVer) or controlVer
    expect(productionStore.getActivePublishedVersion(projectId, pageId)).toBe(variantVer);

    // Promoting an invalid version ID must throw error
    expect(() => {
      productionStore.promoteWinner(exp.id, "ver_unknown_fake");
    }).toThrow(/must match either control or variant version/);

    // Promoting without statistically supported winner must fail (guard check)
    expect(() => {
      productionStore.promoteWinner(exp.id, variantVer);
    }).toThrow(/No statistically supported winner/);

    // Record deterministic synthetic telemetry: 10 control (0 CTA), 10 variant (10 CTA)
    for (let i = 0; i < 10; i++) {
      productionStore.recordTelemetry({
        projectId,
        pageId,
        versionId: controlVer,
        sessionId: `s_c_promote_${i}`,
        viewport: "desktop",
        sessionDurationBucket: "15-30s",
        scrollDepth: { reached25: true, reached50: true, reached75: false, reached100: false },
        ctaClicks: {},
        elementClicks: {},
        trackerVersion: "1.0.0",
        experimentId: exp.id,
        variantId: "control",
      });
      productionStore.recordTelemetry({
        projectId,
        pageId,
        versionId: variantVer,
        sessionId: `s_v_promote_${i}`,
        viewport: "desktop",
        sessionDurationBucket: "15-30s",
        scrollDepth: { reached25: true, reached50: true, reached75: true, reached100: true },
        ctaClicks: { "cta-main": 1 },
        elementClicks: { "cta-main": 1 },
        trackerVersion: "1.0.0",
        experimentId: exp.id,
        variantId: "variant",
      });
    }

    // Attempting to promote the losing control must throw
    expect(() => {
      productionStore.promoteWinner(exp.id, controlVer);
    }).toThrow(/No statistically supported winner/);

    // Promote the statistically supported variant version
    const promoted = productionStore.promoteWinner(exp.id, variantVer);
    expect(promoted).toBe(true);

    const updatedExp = productionStore.getExperiment(exp.id)!;
    expect(updatedExp.status).toBe("concluded");
    expect(updatedExp.promotedVersionId).toBe(variantVer);
    expect(updatedExp.endedAt).not.toBeNull();

    // Active published version must now reflect the promoted winner
    expect(productionStore.getActivePublishedVersion(projectId, pageId)).toBe(variantVer);
  });

  // ─── Test 6: No Raw Personal Data is Stored or Exposed ─────────────────────
  it("Test 6: Telemetry schema and experiment store strictly reject and disallow PII", () => {
    // Verify all common PII and fingerprint keys are in the forbidden payload set
    expect(FORBIDDEN_PAYLOAD_KEYS.has("password")).toBe(true);
    expect(FORBIDDEN_PAYLOAD_KEYS.has("formValues")).toBe(true);
    expect(FORBIDDEN_PAYLOAD_KEYS.has("email")).toBe(true);
    expect(FORBIDDEN_PAYLOAD_KEYS.has("userId")).toBe(true);
    expect(FORBIDDEN_PAYLOAD_KEYS.has("cookies")).toBe(true);
    expect(FORBIDDEN_PAYLOAD_KEYS.has("ip")).toBe(true);

    // Strict schema rejection of forbidden/extraneous fields
    const invalidPayload = {
      projectId: "proj_valid",
      pageId: "page_valid",
      versionId: "ver_valid",
      sessionId: "s_valid_123",
      viewport: "desktop",
      sessionDurationBucket: "15-30s",
      scrollDepth: { reached25: true, reached50: true, reached75: true, reached100: true },
      // Forbidden PII fields
      userId: "usr_12345678",
      email: "user@example.com",
    };

    const parseResult = ProductionTelemetryPayloadSchema.safeParse(invalidPayload);
    expect(parseResult.success).toBe(false);

    // Valid payload without PII succeeds
    const validPayload: ProductionTelemetryPayload = {
      projectId: "proj_valid",
      pageId: "page_valid",
      versionId: "ver_valid",
      sessionId: "s_valid_123",
      viewport: "desktop",
      sessionDurationBucket: "15-30s",
      scrollDepth: { reached25: true, reached50: true, reached75: true, reached100: true },
      ctaClicks: { "btn-cta": 1 },
      elementClicks: { "btn-cta": 1 },
      trackerVersion: "1.0.0",
      experimentId: "exp_valid",
      variantId: "control",
    };

    const validResult = ProductionTelemetryPayloadSchema.safeParse(validPayload);
    expect(validResult.success).toBe(true);
  });
});

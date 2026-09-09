import { test, expect } from "@playwright/test";

test.describe("Milestone 5.6: Closed-Loop Review & MVP Validation E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('[data-layer-id="body-root"]', { timeout: 15000 });
  });

  test("full closed-loop workflow: generate, analyze, optimize, reject, reload persistence, apply, stale state, publish, experiment, inconclusive decisioning, and explicit promote", async ({
    page,
    request,
  }) => {
    test.setTimeout(90000);

    const projectId = "proj_default";
    const pageId = "page_landing";

    // ─── 1. Setup Deterministic UX Analysis Mock Route ────────────────────────
    await page.route("**/api/optimization/analyze", async (route) => {
      const mockResult = {
        id: "ux_analysis_e2e_1",
        timestamp: new Date().toISOString(),
        score: 75,
        severityCounts: { critical: 1, warning: 1, info: 0 },
        categoryCounts: { accessibility: 1, responsive: 0, hierarchy: 0, conversion: 1 },
        findings: [
          {
            id: "finding-1",
            severity: "critical",
            category: "accessibility",
            title: "Interactive elements without accessible name",
            recommendation: "Provide accessible names for buttons and links",
            confidence: 1.0,
            affectedNodeIds: [],
            evidence: "Button without text or aria-label",
          },
          {
            id: "finding-2",
            severity: "warning",
            category: "conversion",
            title: "CTA prominence and contrast",
            recommendation: "Increase visual weight of call to action",
            confidence: 0.9,
            affectedNodeIds: [],
            evidence: "CTA contrast below target ratio",
          },
        ],
        viewport: "desktop",
        documentRevision: 2,
      };

      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: `data: ${JSON.stringify({ type: "status", stage: "Analyzing document" })}\n\ndata: ${JSON.stringify({ type: "result", result: mockResult })}\n\n`,
      });
    });

    // ─── 2. Initial Overview State & Failed Request State ──────────────────────
    const overview = page.locator('[data-testid="project-overview"]');
    await expect(overview).toBeVisible();

    const nextActionBtn = page.locator('[data-testid="next-action"]');
    await expect(nextActionBtn).toBeVisible();

    // Technical evidence stays behind a compact Project health disclosure.
    await page.locator('[data-testid="project-health-toggle"]').click();

    // Verify heuristic labeling requirement
    const decisionHistory = page.locator('[data-testid="decision-history"]');
    await expect(decisionHistory).toContainText("Automated scores are heuristic checks, not proven UX improvement");
    await expect(decisionHistory).toContainText("Preview/test events are separate");

    // Open version activity to make refresh available and test failed request state
    const decisionHistorySummary = page.locator('[data-testid="decision-history"] summary');
    await decisionHistorySummary.click();

    const refreshReviewBtn = page.locator('[data-testid="refresh-review"]');
    await expect(refreshReviewBtn).toBeVisible();

    // Test failed request state
    let failReview = true;
    await page.route("**/api/review*", async (route) => {
      if (failReview) {
        await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Simulated review server error" }) });
      } else {
        await route.continue();
      }
    });

    await refreshReviewBtn.click();
    const alertError = page.locator('[data-testid="project-overview"] [role="alert"]');
    await expect(alertError).toBeVisible({ timeout: 5000 });
    await expect(alertError).toContainText("Live results are temporarily unavailable");

    // Recover from failed request state
    failReview = false;
    await refreshReviewBtn.click();
    await expect(alertError).toBeHidden({ timeout: 5000 });

    // Close details
    await decisionHistorySummary.click();

    // ─── 3. Generate Initial Page ──────────────────────────────────────────────
    // Open chat sidebar via next action or toolbar
    const askAiBtn = page.locator('[data-testid="toolbar-btn-ask-ai"]');
    await askAiBtn.click();

    const generateTab = page.locator('[data-testid="mode-tab-generate"]');
    await generateTab.click();

    const promptInput = page.locator('[data-testid="ai-instruction-input"]');
    await promptInput.fill("Create a dark modern developer landing page");

    const submitGenerateBtn = page.locator('[data-testid="btn-generate-ai-edit"]');
    await submitGenerateBtn.click();

    const resultCard = page.locator('[data-testid="generation-result-card"]').first();
    await expect(resultCard).toBeVisible({ timeout: 15000 });

    // Preview and Apply initial generation
    const previewInitialBtn = resultCard.locator('[data-testid="btn-preview-candidate"]');
    await previewInitialBtn.click();

    const banner = page.locator('[data-testid="generation-preview-banner"]');
    await expect(banner).toBeVisible();

    const applyInitialBtn = banner.locator('[data-testid="btn-banner-apply-candidate"]');
    await applyInitialBtn.click();
    await expect(banner).toBeHidden();

    // Now revision is 2. Pre-publish control version (ver_control_1) for later experiment comparison
    const frame = page.frameLocator('iframe[data-testid="preview-iframe"]');
    const initialHtml = await frame.locator("html").innerHTML();
    const controlVersionId = "ver_control_base";
    const pubCtrlRes = await request.post("/api/production/publish", {
      data: {
        projectId,
        pageId,
        versionId: controlVersionId,
        title: "Control Baseline Version",
        html: `<!DOCTYPE html><html>${initialHtml}</html>`,
        trackingEnabled: true,
      },
    });
    expect(pubCtrlRes.ok()).toBe(true);

    // ─── 4. Analyze Current Version ────────────────────────────────────────────
    const analyzeUxBtn = page.locator('[data-testid="toolbar-btn-analyze-ux"]');
    await expect(nextActionBtn).toContainText("Analyze current version");
    await nextActionBtn.click();

    const optPanel = page.locator('[data-testid="optimization-panel"]');
    await expect(optPanel).toBeVisible();

    const analyzeBtn = page.locator('[data-testid="btn-analyze-ux"]');
    await expect(analyzeBtn).toBeVisible();
    await analyzeBtn.click();

    const uxScore = page.locator('[data-testid="ux-score"]');
    await expect(uxScore).toBeVisible({ timeout: 10000 });

    // ─── 5. Optimize: Select Finding & Generate Candidate 1 (To Reject) ────────
    const firstCheckbox = page.locator('input[data-testid^="finding-checkbox-"]').first();
    await expect(firstCheckbox).toBeVisible();
    await firstCheckbox.click();

    const countBadge = page.locator('[data-testid="selected-finding-count"]');
    await expect(countBadge).toContainText("1 selected");

    const generateOptBtn = page.locator('[data-testid="btn-generate-optimization-candidate"]');
    await expect(generateOptBtn).toBeEnabled();
    await generateOptBtn.click();

    // ─── 6. Compare & Reject Candidate 1 ───────────────────────────────────────
    await expect(banner).toBeVisible({ timeout: 15000 });
    await expect(banner).toContainText("Generated Preview (Uncommitted)");

    // Test Compare toggle
    const compareBtn = banner.locator('[data-testid="btn-banner-compare-candidate"]');
    await compareBtn.click();
    await expect(banner).toContainText("Comparing: Current Document");

    await compareBtn.click();
    await expect(banner).toContainText("Generated Preview (Uncommitted)");

    // Reject Candidate 1 via Optimization Panel
    const rejectBtn = page.locator('[data-testid="btn-reject-comparison"]').or(
      page.locator('[data-testid="btn-reject-candidate"]').first()
    );
    await expect(rejectBtn).toBeVisible();
    await rejectBtn.click();

    // Banner closes after rejection
    await expect(banner).toBeHidden();

    // Verify Decision History shows rejected candidate
    await decisionHistory.locator("summary").click();
    await expect(decisionHistory).toContainText("rejected");

    // ─── 7. Verify Reload Persistence ──────────────────────────────────────────
    await page.reload();
    await page.waitForSelector('[data-layer-id="body-root"]', { timeout: 15000 });

    // Open decision history again after reload
    const decisionHistoryAfterReload = page.locator('[data-testid="decision-history"]');
    await decisionHistoryAfterReload.locator("summary").click();
    await expect(decisionHistoryAfterReload).toContainText("rejected");

    // Reopen UX Analyzer panel
    await analyzeUxBtn.click();
    await expect(optPanel).toBeVisible();

    // Verify finding selection persisted across reload
    await expect(countBadge).toContainText("1 selected");

    // ─── 8. Generate & Apply Candidate 2 ───────────────────────────────────────
    await generateOptBtn.click();
    await expect(banner).toBeVisible({ timeout: 15000 });

    const applyCandidateBtn = banner.locator('[data-testid="btn-banner-apply-candidate"]');
    await applyCandidateBtn.click();
    await expect(banner).toBeHidden();

    // Document is now at revision 3. The previous UX analysis (done at rev 2) is now stale
    const overviewAnalysis = page.locator('[data-testid="overview-analysis"]');
    await expect(overviewAnalysis).toContainText("Stale — analyze again");

    // ─── 9. Explicit Publish Flow (No Auto-Publish) ────────────────────────────
    // Verify no automatic publish happened for current version
    const overviewLive = page.locator('[data-testid="overview-live"]');
    await expect(overviewLive).toContainText("not published");

    // Next action now directs to publish
    await expect(nextActionBtn).toContainText("Publish applied version");
    await nextActionBtn.click();

    const publishDialog = page.locator('[data-testid="publish-dialog"]');
    await expect(publishDialog).toBeVisible();

    const confirmPublishBtn = page.locator('[data-testid="btn-confirm-publish"]');
    await confirmPublishBtn.click();

    // Wait for publish success and close dialog
    const doneBtn = publishDialog.locator("button", { hasText: "Done" });
    await expect(doneBtn).toBeVisible({ timeout: 10000 });
    await doneBtn.click();
    await expect(publishDialog).toBeHidden();

    // ─── 10. Create Experiment ────────────────────────────────────────────────
    // Next action now guides to Create Experiment
    await expect(nextActionBtn).toContainText("Create experiment");
    await nextActionBtn.click();

    const createExpDialog = page.locator('[data-testid="create-experiment-dialog"]');
    await expect(createExpDialog).toBeVisible();

    const nameInput = page.locator('[data-testid="input-experiment-name"]');
    await nameInput.fill("Closed Loop Optimization Test");

    const selectCtrl = page.locator('[data-testid="select-control-version"]');
    await expect(selectCtrl).toBeVisible();
    await selectCtrl.selectOption(controlVersionId);

    const selectVar = page.locator('[data-testid="select-variant-version"]');
    await expect(selectVar).toBeVisible();
    await selectVar.selectOption({ index: 1 });
    const variantVersionId = await selectVar.inputValue();
    expect(variantVersionId).not.toBe(controlVersionId);

    const sampleSizeInput = page.locator('[data-testid="input-min-sample-size"]');
    await sampleSizeInput.fill("20");

    const launchExpBtn = page.locator('[data-testid="btn-submit-create-experiment"]');
    await launchExpBtn.click();
    await expect(createExpDialog).toBeHidden({ timeout: 5000 });

    const expDashboard = page.locator('[data-testid="experiment-dashboard"]');
    await expect(expDashboard).toBeVisible();

    const selectExp = page.locator('[data-testid="select-experiment"]');
    await expect(selectExp).toBeVisible();
    const experimentId = await selectExp.inputValue();

    // ─── 11. Verify Inconclusive Decisioning & No Auto-Promotion ───────────────
    // Submit below quota synthetic telemetry (5 sessions each = 10 total < 20 quota)
    for (let i = 1; i <= 5; i++) {
      await request.post("/api/production/telemetry", {
        data: {
          projectId,
          pageId,
          versionId: controlVersionId,
          sessionId: `s_ctrl_inconc_${i}`,
          viewport: "desktop",
          sessionDurationBucket: "15-30s",
          scrollDepth: { reached25: true, reached50: false, reached75: false, reached100: false },
          ctaClicks: {},
          elementClicks: {},
          trackerVersion: "1.0.0",
          experimentId,
          variantId: "control",
        },
      });
      await request.post("/api/production/telemetry", {
        data: {
          projectId,
          pageId,
          versionId: variantVersionId,
          sessionId: `s_var_inconc_${i}`,
          viewport: "desktop",
          sessionDurationBucket: "15-30s",
          scrollDepth: { reached25: true, reached50: true, reached75: true, reached100: true },
          ctaClicks: { "cta-action": 1 },
          elementClicks: { "cta-action": 1 },
          trackerVersion: "1.0.0",
          experimentId,
          variantId: "variant",
        },
      });
    }

    const refreshExpBtn = page.locator('[data-testid="btn-refresh-experiment"]');
    await refreshExpBtn.click();

    // Verify insufficient data state
    const insufficientState = page.locator('[data-testid="state-insufficient-data"]');
    await expect(insufficientState).toBeVisible();

    // Verify promotion button is NOT visible / not enabled
    const promoteWinnerBtn = page.locator('[data-testid="btn-promote-winner"]');
    await expect(promoteWinnerBtn).toBeHidden();

    // Attempting direct promote API without statistical winner must fail with 400
    const illegalPromoteRes = await request.post(`/api/experiment/${experimentId}/promote`, {
      data: {
        versionId: variantVersionId,
        confirmed: true,
      },
    });
    expect(illegalPromoteRes.status()).toBe(400);
    const errJson = await illegalPromoteRes.json();
    expect(errJson.error).toContain("No statistically supported winner");

    // ─── 12. Submit Significant Events & Explicit Promotion ───────────────────
    // Submit remaining sessions to reach quota and statistical significance
    // 10 control total (0 conversions = 0%), 10 variant total (10 conversions = 100%)
    for (let i = 6; i <= 10; i++) {
      await request.post("/api/production/telemetry", {
        data: {
          projectId,
          pageId,
          versionId: controlVersionId,
          sessionId: `s_ctrl_sig_${i}`,
          viewport: "desktop",
          sessionDurationBucket: "15-30s",
          scrollDepth: { reached25: true, reached50: false, reached75: false, reached100: false },
          ctaClicks: {},
          elementClicks: {},
          trackerVersion: "1.0.0",
          experimentId,
          variantId: "control",
        },
      });
      await request.post("/api/production/telemetry", {
        data: {
          projectId,
          pageId,
          versionId: variantVersionId,
          sessionId: `s_var_sig_${i}`,
          viewport: "desktop",
          sessionDurationBucket: ">3m",
          scrollDepth: { reached25: true, reached50: true, reached75: true, reached100: true },
          ctaClicks: { "cta-action": 2 },
          elementClicks: { "cta-action": 2 },
          trackerVersion: "1.0.0",
          experimentId,
          variantId: "variant",
        },
      });
    }

    await refreshExpBtn.click();

    // Winner banner now appears with Fisher exact p <= 0.05
    const winnerBanner = page.locator('[data-testid="state-winner-recommended"]');
    await expect(winnerBanner).toBeVisible();
    await expect(winnerBanner).toContainText("Recommended Winner: VARIANT");

    // Verify no automatic promotion: status remains "running"
    const statusBadge = page.locator('[data-testid="badge-experiment-status"]');
    await expect(statusBadge).toContainText("running");

    // Explicit Promote Flow
    await expect(promoteWinnerBtn).toBeVisible();
    await promoteWinnerBtn.click();

    const confirmPromoteModal = page.locator('[data-testid="modal-confirm-promote"]');
    await expect(confirmPromoteModal).toBeVisible();

    const confirmPromoteBtn = page.locator('[data-testid="btn-confirm-promote-winner"]');
    await confirmPromoteBtn.click();

    await expect(confirmPromoteModal).toBeHidden();
    await expect(statusBadge).toContainText("concluded");

    // ─── 13. Reload Persistence of Concluded State ─────────────────────────────
    await page.reload();
    await page.waitForSelector('[data-layer-id="body-root"]', { timeout: 15000 });

    const finalDecisionHistory = page.locator('[data-testid="decision-history"]');
    await finalDecisionHistory.locator("summary").click();
    await expect(finalDecisionHistory).toContainText("rejected");
    await expect(finalDecisionHistory).toContainText("applied");
  });
});

import { test, expect } from "@playwright/test";

test.describe("Milestone 5.5: UX Experiments & Decisioning E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('[data-layer-id="body-root"]', { timeout: 15000 });
  });

  test("create mock experiment, submit mock events, view result, and promote winner", async ({
    page,
    request,
  }) => {
    const projectId = "proj_default";
    const pageId = "page_landing";
    const controlVersionId = "ver_e2e_ctrl_1";
    const variantVersionId = "ver_e2e_var_2";

    // 1. Pre-publish Control and Variant versions via server API
    const pubRes1 = await request.post("/api/production/publish", {
      data: {
        projectId,
        pageId,
        versionId: controlVersionId,
        title: "Control Version A",
        html: `<!DOCTYPE html><html><body><h1 data-editor-id="heading-1">Original Heading</h1><button data-editor-id="cta-action">Sign Up</button></body></html>`,
        trackingEnabled: true,
      },
    });
    expect(pubRes1.ok()).toBe(true);

    const pubRes2 = await request.post("/api/production/publish", {
      data: {
        projectId,
        pageId,
        versionId: variantVersionId,
        title: "Variant Version B",
        html: `<!DOCTYPE html><html><body><h1 data-editor-id="heading-1">High Converting Heading</h1><button data-editor-id="cta-action">Get Started Free</button></body></html>`,
        trackingEnabled: true,
      },
    });
    expect(pubRes2.ok()).toBe(true);

    // 2. Open UX Analyzer panel
    const analyzeUxBtn = page.locator('[data-testid="toolbar-btn-analyze-ux"]');
    await expect(analyzeUxBtn).toBeVisible();
    await analyzeUxBtn.click();

    const optPanel = page.locator('[data-testid="optimization-panel"]');
    await expect(optPanel).toBeVisible();

    // 3. Switch to "A/B Test" tab
    const experimentTab = page.locator('[data-testid="tab-evidence-experiment"]');
    await expect(experimentTab).toBeVisible();
    await experimentTab.click();

    // 4. Click to create new experiment
    const newExpBtn = page.locator('[data-testid="btn-create-experiment-from-empty"]').or(
      page.locator('[data-testid="btn-new-experiment"]')
    );
    await expect(newExpBtn).toBeVisible();
    await newExpBtn.click();

    // 5. Verify Create Experiment Dialog opens
    const createDialog = page.locator('[data-testid="create-experiment-dialog"]');
    await expect(createDialog).toBeVisible();

    // Fill in name
    const nameInput = page.locator('[data-testid="input-experiment-name"]');
    await nameInput.fill("E2E Hero Conversion Test");

    // Select Control and Variant versions
    const selectCtrl = page.locator('[data-testid="select-control-version"]').or(
      page.locator('[data-testid="input-control-version"]')
    );
    if (await selectCtrl.getAttribute("data-testid") === "select-control-version") {
      await selectCtrl.selectOption(controlVersionId);
    } else {
      await selectCtrl.fill(controlVersionId);
    }

    const selectVar = page.locator('[data-testid="select-variant-version"]').or(
      page.locator('[data-testid="input-variant-version"]')
    );
    if (await selectVar.getAttribute("data-testid") === "select-variant-version") {
      await selectVar.selectOption(variantVersionId);
    } else {
      await selectVar.fill(variantVersionId);
    }

    // Set sample size to 10 total (5 per variant) for fast test execution
    const sampleSizeInput = page.locator('[data-testid="input-min-sample-size"]');
    await sampleSizeInput.fill("10");

    // Click Launch Experiment
    const launchBtn = page.locator('[data-testid="btn-submit-create-experiment"]');
    await expect(launchBtn).toBeEnabled();
    await launchBtn.click();

    // Verify dialog closes and dashboard renders
    await expect(createDialog).toBeHidden({ timeout: 5000 });

    const dashboard = page.locator('[data-testid="experiment-dashboard"]');
    await expect(dashboard).toBeVisible();

    // 6. Verify initial "Insufficient Data" state
    const insufficientState = page.locator('[data-testid="state-insufficient-data"]');
    await expect(insufficientState).toBeVisible();
    await expect(insufficientState).toContainText("Insufficient Data for Decisioning");

    // Retrieve active experiment ID from the select dropdown
    const selectExp = page.locator('[data-testid="select-experiment"]');
    await expect(selectExp).toBeVisible();
    const experimentId = await selectExp.inputValue();
    expect(experimentId).toContain("exp_");

    // 7. Submit mock events for both variants:
    // Control: 6 sessions, 0 conversions (0%)
    for (let i = 1; i <= 6; i++) {
      const cRes = await request.post("/api/production/telemetry", {
        data: {
          projectId,
          pageId,
          versionId: controlVersionId,
          sessionId: `s_ctrl_${i}`,
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
      expect(cRes.ok()).toBe(true);
    }

    // Variant: 6 sessions, 6 conversions with cta clicks (100%)
    for (let i = 1; i <= 6; i++) {
      const vRes = await request.post("/api/production/telemetry", {
        data: {
          projectId,
          pageId,
          versionId: variantVersionId,
          sessionId: `s_var_${i}`,
          viewport: "desktop",
          sessionDurationBucket: ">3m",
          scrollDepth: { reached25: true, reached50: true, reached75: true, reached100: true },
          ctaClicks: { "cta-action": 3 },
          elementClicks: { "cta-action": 3 },
          trackerVersion: "1.0.0",
          experimentId,
          variantId: "variant",
        },
      });
      expect(vRes.ok()).toBe(true);
    }

    // 8. Refresh dashboard metrics
    const refreshBtn = page.locator('[data-testid="btn-refresh-experiment"]');
    await refreshBtn.click();

    // 9. Verify sample size counter reflects new sessions (10 / 10)
    const counter = page.locator('[data-testid="sample-size-counter"]');
    await expect(counter).toContainText("10 / 10 sessions");

    // 10. Verify conversion rates in comparison cards
    const ctrlRate = page.locator('[data-testid="control-conversion-rate"]');
    await expect(ctrlRate).toContainText("0.0%");

    const varRate = page.locator('[data-testid="variant-conversion-rate"]');
    await expect(varRate).toContainText("100.0%");

    // 11. Verify Winner Recommended Banner
    const winnerBanner = page.locator('[data-testid="state-winner-recommended"]');
    await expect(winnerBanner).toBeVisible();
    await expect(winnerBanner).toContainText("Recommended Winner: VARIANT");

    // 12. Click "Promote Winner to Live"
    const promoteBtn = page.locator('[data-testid="btn-promote-winner"]');
    await expect(promoteBtn).toBeVisible();
    await promoteBtn.click();

    // 13. Verify confirmation modal appears
    const confirmModal = page.locator('[data-testid="modal-confirm-promote"]');
    await expect(confirmModal).toBeVisible();
    await expect(confirmModal).toContainText(variantVersionId);

    // 14. Confirm promotion
    const confirmBtn = page.locator('[data-testid="btn-confirm-promote-winner"]');
    await confirmBtn.click();

    // 15. Verify confirmation modal closes and status changes to concluded
    await expect(confirmModal).toBeHidden();
    const statusBadge = page.locator('[data-testid="badge-experiment-status"]');
    await expect(statusBadge).toContainText("concluded");
  });
});

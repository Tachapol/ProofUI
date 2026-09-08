import { test, expect } from "@playwright/test";

test.describe("Milestone 5.4: Production Evidence & Deploy E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('[data-layer-id="body-root"]', { timeout: 15000 });
  });

  test("publish mock page, submit mock events, view dashboard evidence, and create live optimization", async ({
    page,
    request,
  }) => {
    // 1. Open Publish Dialog from Toolbar
    const publishBtn = page.locator('[data-testid="toolbar-btn-publish"]');
    await expect(publishBtn).toBeVisible();
    await publishBtn.click();

    const publishDialog = page.locator('[data-testid="publish-dialog"]');
    await expect(publishDialog).toBeVisible();

    // 2. Ensure tracking is enabled (opt-in checkbox)
    const trackingCheckbox = page.locator('[data-testid="publish-tracking-checkbox"]');
    await expect(trackingCheckbox).toBeChecked();

    // 3. Confirm Publish
    const confirmBtn = page.locator('[data-testid="btn-confirm-publish"]');
    await confirmBtn.click();

    // 4. Verify publish success view
    const urlInput = page.locator('[data-testid="published-url-link"]');
    await expect(urlInput).toBeVisible({ timeout: 10000 });
    const publishedUrl = await urlInput.inputValue();
    expect(publishedUrl).toContain("/api/production/view/proj_default/");

    // Extract versionId from the published url
    const parts = publishedUrl.split("/");
    const versionId = parts[parts.length - 1];
    expect(versionId).toBeTruthy();

    // 5. Submit mock production telemetry events to the server endpoint
    // Session 1
    const res1 = await request.post("/api/production/telemetry", {
      data: {
        projectId: "proj_default",
        pageId: "page_landing",
        versionId,
        sessionId: "s_e2e_session_1",
        viewport: "desktop",
        sessionDurationBucket: "1-3m",
        scrollDepth: {
          reached25: true,
          reached50: true,
          reached75: true,
          reached100: false,
        },
        ctaClicks: { "hero-cta": 2 },
        elementClicks: { "hero-cta": 2 },
        trackerVersion: "1.0.0",
      },
    });
    expect(res1.ok()).toBe(true);

    // Session 2
    const res2 = await request.post("/api/production/telemetry", {
      data: {
        projectId: "proj_default",
        pageId: "page_landing",
        versionId,
        sessionId: "s_e2e_session_2",
        viewport: "mobile",
        sessionDurationBucket: "15-30s",
        scrollDepth: {
          reached25: true,
          reached50: false,
          reached75: false,
          reached100: false,
        },
        ctaClicks: {},
        elementClicks: {},
        trackerVersion: "1.0.0",
      },
    });
    expect(res2.ok()).toBe(true);

    // 6. Close the Publish Dialog
    const doneBtn = page.getByRole("button", { name: "Done" });
    await doneBtn.click();
    await expect(publishDialog).toBeHidden();

    // 7. Open UX Analyzer panel
    const analyzeUxBtn = page.locator('[data-testid="toolbar-btn-analyze-ux"]');
    await analyzeUxBtn.click();

    const optPanel = page.locator('[data-testid="optimization-panel"]');
    await expect(optPanel).toBeVisible();

    // 8. Switch to "Production (Live)" evidence tab
    const prodTab = page.locator('[data-testid="tab-evidence-production"]');
    await expect(prodTab).toBeVisible();
    await prodTab.click();

    // 9. Verify Production Evidence Dashboard content
    const dashboard = page.locator('[data-testid="production-evidence-dashboard"]');
    await expect(dashboard).toBeVisible();

    // Select the version in filter dropdown
    const filterSelect = page.locator('[data-testid="production-version-filter"]');
    if (await filterSelect.isVisible()) {
      await filterSelect.selectOption(versionId);
    }

    // Check total sessions
    const totalSessions = page.locator('[data-testid="production-total-sessions"]');
    await expect(totalSessions).toContainText("Total Validated Sessions:");

    // Check scroll depth distribution
    const scrollDepth = page.locator('[data-testid="production-scroll-depth"]');
    await expect(scrollDepth).toBeVisible();
    await expect(scrollDepth).toContainText("25%");

    // Check CTA clicks displays hero-cta
    const ctaClicks = page.locator('[data-testid="production-cta-clicks"]');
    await expect(ctaClicks).toBeVisible();
    await expect(ctaClicks).toContainText("hero-cta");

    // 10. Click "Create optimization from live evidence"
    const createOptBtn = page.locator('[data-testid="btn-create-live-optimization"]');
    await expect(createOptBtn).toBeVisible();
    await createOptBtn.click();

    // 11. Verify UX score and conversion findings appear
    await expect(page.locator('[data-testid="ux-score"]')).toBeVisible({ timeout: 10000 });

    // Verify finding with conversion category from live evidence
    const findingsList = page.locator('[data-testid="findings-list"]');
    await expect(findingsList).toBeVisible();
    await expect(findingsList).toContainText("Important element received zero interactions in production");

    // Verify at least one finding is automatically selected
    const countBadge = page.locator('[data-testid="selected-finding-count"]');
    await expect(countBadge).not.toContainText("0 selected");

    // Verify "Generate Optimization Candidate" is enabled for the safe Preview → Compare → Apply flow
    const generateCandidateBtn = page.locator('[data-testid="btn-generate-optimization-candidate"]');
    await expect(generateCandidateBtn).toBeEnabled();
  });
});

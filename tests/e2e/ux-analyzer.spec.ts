import { test, expect } from "@playwright/test";

test.describe("Visual HTML Editor - Milestone 5.2A UX Analyzer", () => {
  test("full UX analysis workflow: run analysis, view score, switch viewports, select element, and detect stale analysis", async ({
    page,
  }) => {
    // 1. Navigate to editor
    await page.goto("/");

    // 2. Wait for preview iframe and layers panel to load
    const iframeElement = page.locator('iframe[data-testid="preview-iframe"]');
    await expect(iframeElement).toBeVisible();

    const layersPanel = page.locator('[data-testid="layers-panel"]');
    await expect(layersPanel).toBeVisible();
    await page.waitForSelector('[data-layer-id="body-root"]', { timeout: 15000 });

    // 3. Open UX Analyzer via tab or toolbar button
    const toolbarAnalyzeBtn = page.locator('[data-testid="toolbar-btn-analyze-ux"]');
    await expect(toolbarAnalyzeBtn).toBeVisible();
    await toolbarAnalyzeBtn.click();

    const optimizationPanel = page.locator('[data-testid="optimization-panel"]');
    await expect(optimizationPanel).toBeVisible();

    // Verify initial empty state before running analysis
    await expect(optimizationPanel).toContainText("Deterministic UX Audit");

    // 4. Click Analyze UX button
    const analyzeBtn = page.locator('[data-testid="btn-analyze-ux"]');
    await expect(analyzeBtn).toBeVisible();
    await analyzeBtn.click();

    // Verify score card appears with score 0-100
    const uxScore = page.locator('[data-testid="ux-score"]');
    await expect(uxScore).toBeVisible({ timeout: 10000 });

    const scoreText = await uxScore.textContent();
    const scoreVal = parseInt(scoreText?.trim() || "0", 10);
    expect(scoreVal).toBeGreaterThanOrEqual(0);
    expect(scoreVal).toBeLessThanOrEqual(100);

    // Verify severity counters are rendered
    await expect(page.locator('[data-testid="count-critical"]')).toBeVisible();
    await expect(page.locator('[data-testid="count-warning"]')).toBeVisible();
    await expect(page.locator('[data-testid="count-info"]')).toBeVisible();

    // 5. Test Viewport Switch to Mobile and re-analyze
    const mobileVpBtn = page.locator('[data-testid="opt-viewport-mobile"]');
    await expect(mobileVpBtn).toBeVisible();
    await mobileVpBtn.click();

    // Re-run analysis in mobile mode
    await analyzeBtn.click();
    await expect(uxScore).toBeVisible({ timeout: 10000 });
    await expect(optimizationPanel).toContainText("mobile viewport");

    // 6. Test Element Selection from a Finding
    // Look for an affected element button (e.g. #hero-glow)
    const affectedNodeBtn = optimizationPanel.locator('button[data-testid^="affected-node-"]').first();
    const hasAffectedNodes = await affectedNodeBtn.isVisible().catch(() => false);

    if (hasAffectedNodes) {
      const nodeIdText = await affectedNodeBtn.textContent();
      const nodeId = nodeIdText?.replace("#", "").trim() || "";

      await affectedNodeBtn.click();

      // Verify that element is selected in the canvas
      const selectionOutline = page.locator('[data-testid="selection-outline"]');
      await expect(selectionOutline).toBeVisible();

      // Verify layers panel selected row matches
      if (nodeId) {
        const layerRow = page.locator(`[data-layer-id="${nodeId}"]`);
        await expect(layerRow).toHaveClass(/bg-indigo-600/);
      }
    }

    // 7. Verify Stale Analysis Detection
    // Switch to Properties tab
    const tabProperties = page.locator('[data-testid="tab-properties"]');
    await expect(tabProperties).toBeVisible();
    await tabProperties.click();

    const propertiesPanel = page.locator('[data-testid="properties-panel"]');
    await expect(propertiesPanel).toBeVisible();

    // Select an element in iframe to make an edit
    const frame = page.frameLocator('iframe[data-testid="preview-iframe"]');
    const heroSubtitle = frame.locator('[data-editor-id="hero-subtitle"]');
    await heroSubtitle.click();

    // Edit text content in properties panel
    const textInput = page.locator('[data-testid="property-text-input"]');
    await expect(textInput).toBeVisible();
    await textInput.fill("Updated text content to trigger document revision change.");
    await page.waitForTimeout(450); // debounce wait

    // Switch back to UX Analyzer tab
    const tabOptimization = page.locator('[data-testid="tab-optimization"]');
    await tabOptimization.click();
    await expect(optimizationPanel).toBeVisible();

    // Verify stale warning badge is visible
    const staleBadge = page.locator('[data-testid="analysis-stale-badge"]');
    await expect(staleBadge).toBeVisible();
    await expect(staleBadge).toContainText("Analysis is Outdated");
  });
});

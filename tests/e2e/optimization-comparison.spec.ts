import { test, expect } from "@playwright/test";

test.describe("Milestone 5.2C: Before/After Evidence Comparison", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('[data-layer-id="body-root"]', { timeout: 15000 });
  });

  test("computes before/after comparison, shows score delta & findings breakdown, node selection, reject, apply, and re-analysis", async ({
    page,
  }) => {
    // 1. Open Optimization Panel
    const tabOptimization = page.locator('[data-testid="tab-optimization"]');
    await tabOptimization.click();
    const optPanel = page.locator('[data-testid="optimization-panel"]');
    await expect(optPanel).toBeVisible();

    // 2. Run baseline analysis
    const analyzeBtn = page.locator('[data-testid="btn-analyze-ux"]');
    await expect(analyzeBtn).toBeVisible();
    await analyzeBtn.click();
    await expect(page.locator('[data-testid="ux-score"]')).toBeVisible({ timeout: 10000 });

    // 3. Select finding for optimization
    const firstCheckbox = page.locator('input[data-testid^="finding-checkbox-"]').first();
    await expect(firstCheckbox).toBeVisible();
    await firstCheckbox.click();

    // 4. Generate candidate
    const generateCandidateBtn = page.locator('[data-testid="btn-generate-optimization-candidate"]');
    await expect(generateCandidateBtn).toBeEnabled();
    await generateCandidateBtn.click();

    // 5. Verify Before/After Comparison Card is displayed in OptimizationPanel
    const comparisonCard = page.locator('[data-testid="optimization-comparison-card"]');
    await expect(comparisonCard).toBeVisible({ timeout: 15000 });

    // 6. Verify Score Delta display (e.g. UX score: X → Y (+Z))
    const scoreDelta = page.locator('[data-testid="comparison-score-delta"]');
    await expect(scoreDelta).toBeVisible();
    await expect(scoreDelta).toContainText("UX score:");

    // Verify canvas preview banner also displays score delta badge
    const bannerScoreDelta = page.locator('[data-testid="banner-ux-score-delta"]');
    await expect(bannerScoreDelta).toBeVisible();
    await expect(bannerScoreDelta).toContainText("UX score:");

    // 7. Verify Resolved, Remaining, and New Issues sections
    const resolvedSection = page.locator('[data-testid="comparison-resolved-section"]');
    const remainingSection = page.locator('[data-testid="comparison-remaining-section"]');
    const newSection = page.locator('[data-testid="comparison-new-section"]');

    await expect(resolvedSection).toBeVisible();
    await expect(remainingSection).toBeVisible();
    await expect(newSection).toBeVisible();

    await expect(resolvedSection).toContainText("Resolved Issues");
    await expect(remainingSection).toContainText("Remaining Issues");
    await expect(newSection).toContainText("New Issues");

    // 8. Test node selection from comparison card
    const nodeBtn = page.locator('[data-testid^="comparison-node-"]').first();
    if (await nodeBtn.isVisible()) {
      await nodeBtn.click();
    }

    // 9. Test Reject button in Comparison Card (leaves canonical document unchanged)
    const rejectBtn = page.locator('[data-testid="btn-reject-comparison"]');
    await expect(rejectBtn).toBeVisible();
    await rejectBtn.click();

    // Comparison card and preview banner disappear
    await expect(comparisonCard).toBeHidden();
    await expect(page.locator('[data-testid="generation-preview-banner"]')).toBeHidden();

    // Analysis is still fresh (not stale)
    await expect(page.locator('[data-testid="analysis-stale-badge"]')).toBeHidden();

    // 10. Generate candidate again to test Apply flow
    await generateCandidateBtn.click();
    await expect(comparisonCard).toBeVisible({ timeout: 15000 });

    // 11. Apply candidate via Comparison Card Apply button
    const applyBtn = page.locator('[data-testid="btn-apply-comparison"]');
    await expect(applyBtn).toBeVisible();
    await applyBtn.click();

    // Comparison card and preview banner close
    await expect(comparisonCard).toBeHidden();

    // 12. Prior analysis is now marked stale for the new revision
    const staleBadge = page.locator('[data-testid="analysis-stale-badge"]');
    await expect(staleBadge).toBeVisible();
    await expect(staleBadge).toContainText("Analysis is Outdated");

    // 13. Verify "Analyze UX again" button is offered and re-runs analysis on new revision
    const reanalyzeBtn = page.locator('[data-testid="btn-reanalyze-after-apply"]');
    await expect(reanalyzeBtn).toBeVisible();
    await reanalyzeBtn.click();

    // Stale badge disappears after re-analysis
    await expect(staleBadge).toBeHidden({ timeout: 10000 });
    await expect(page.locator('[data-testid="ux-score"]')).toBeVisible();
  });
});

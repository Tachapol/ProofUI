import { test, expect } from "@playwright/test";

test.describe("Milestone 5.2B: Optimization Candidate Generation, Preview, Compare, Apply, and Reject", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('[data-layer-id="body-root"]', { timeout: 15000 });
  });

  test("full optimization candidate workflow: selection, generation, preview banner, compare, reject, apply, and staleness", async ({
    page,
  }) => {
    // 1. Open UX Analyzer via tab or toolbar
    const tabOptimization = page.locator('[data-testid="tab-optimization"]');
    await tabOptimization.click();
    const optPanel = page.locator('[data-testid="optimization-panel"]');
    await expect(optPanel).toBeVisible();

    // 2. Run analysis to get findings
    const analyzeBtn = page.locator('[data-testid="btn-analyze-ux"]');
    await expect(analyzeBtn).toBeVisible();
    await analyzeBtn.click();
    await expect(page.locator('[data-testid="ux-score"]')).toBeVisible({ timeout: 10000 });

    // 3. Verify Optimization Candidate button is initially disabled (0 findings selected)
    const generateCandidateBtn = page.locator('[data-testid="btn-generate-optimization-candidate"]');
    await expect(generateCandidateBtn).toBeVisible();
    await expect(generateCandidateBtn).toBeDisabled();

    // Selected finding count should show 0 selected
    const countBadge = page.locator('[data-testid="selected-finding-count"]');
    await expect(countBadge).toContainText("0 selected");

    // 4. Select a finding via checkbox
    const firstCheckbox = page.locator('input[data-testid^="finding-checkbox-"]').first();
    await expect(firstCheckbox).toBeVisible();
    await firstCheckbox.click();

    // Verify count updated and button is now enabled
    await expect(countBadge).toContainText("1 selected");
    await expect(generateCandidateBtn).toBeEnabled();

    // 5. Fill optional user goal
    const goalInput = page.locator('[data-testid="optimization-user-goal-input"]');
    await goalInput.fill("Improve visual contrast and mobile responsiveness");

    // 6. Click "Generate Optimization Candidate"
    await generateCandidateBtn.click();

    // 7. Verify candidate preview banner appears over canvas
    const previewBanner = page.locator('[data-testid="generation-preview-banner"]');
    await expect(previewBanner).toBeVisible({ timeout: 15000 });
    await expect(previewBanner).toContainText("Generated Preview (Uncommitted)");

    // Verify Optimization Panel remains open
    await expect(optPanel).toBeVisible();

    // 8. Test Compare button on banner
    const compareBtn = page.locator('[data-testid="btn-banner-compare-candidate"]');
    await expect(compareBtn).toBeVisible();
    await compareBtn.click();
    await expect(previewBanner).toContainText("Comparing: Current Document");

    await compareBtn.click();
    await expect(previewBanner).toContainText("Generated Preview (Uncommitted)");

    // 9. Test Exit / Reject preview (leaves canonical document unchanged)
    const exitBtn = page.locator('[data-testid="btn-banner-exit-preview"]');
    await exitBtn.click();
    await expect(previewBanner).toBeHidden();

    // Document revision should still be original (analysis is still fresh, not stale)
    await expect(page.locator('[data-testid="stale-analysis-warning"]')).toBeHidden();

    // 10. Generate candidate again to test Apply
    await generateCandidateBtn.click();
    await expect(previewBanner).toBeVisible({ timeout: 15000 });

    // 11. Apply candidate
    const applyBtn = page.locator('[data-testid="btn-banner-apply-candidate"]');
    await expect(applyBtn).toBeVisible();
    await applyBtn.click();

    // Verify banner disappears after apply
    await expect(previewBanner).toBeHidden();

    // Verify previous analysis is now automatically marked stale due to revision increment
    const staleWarning = page.locator('[data-testid="stale-analysis-warning"]');
    await expect(staleWarning).toBeVisible();
    await expect(generateCandidateBtn).toBeDisabled();
  });
});

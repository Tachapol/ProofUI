import { test, expect } from "@playwright/test";

test.describe("Milestone 4: Website URL Import, Capture, and Extraction", () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.addInitScript(() => {
      window.localStorage.clear();
    });
  });

  test("rejects private/SSRF and unsupported URLs with friendly error", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector('[data-testid="toolbar-btn-import"]');

    // Open Import dialog
    await page.click('[data-testid="toolbar-btn-import"]');
    await expect(page.locator('[data-testid="import-website-dialog"]')).toBeVisible();

    // 1. Try file: scheme
    await page.fill('[data-testid="import-url-input"]', "file:///etc/passwd");
    await page.click('[data-testid="import-start-btn"]');
    await expect(page.locator("text=not supported")).toBeVisible({ timeout: 5000 });

    // 2. Try private IP
    await page.fill('[data-testid="import-url-input"]', "http://192.168.1.1/admin");
    await page.click('[data-testid="import-start-btn"]');
    await expect(page.locator("text=private or reserved network")).toBeVisible({ timeout: 5000 });

    // 3. Try cloud metadata IP
    await page.fill('[data-testid="import-url-input"]', "http://169.254.169.254/latest/meta-data");
    await page.click('[data-testid="import-start-btn"]');
    await expect(page.locator("text=prohibited").or(page.locator("text=internal network"))).toBeVisible({ timeout: 5000 });
  });

  test("captures local fixture, reviews tokens and DESIGN.md, and imports into editor with single undo", async ({ page }) => {
    // Increase test timeout for browser capture
    test.setTimeout(60000);

    await page.goto("/");
    await page.waitForSelector('[data-testid="toolbar-btn-import"]');

    // Open Import dialog
    await page.click('[data-testid="toolbar-btn-import"]');
    const dialog = page.locator('[data-testid="import-website-dialog"]');
    await expect(dialog).toBeVisible();

    // Input fixture URL
    const fixtureUrl = "http://localhost:3000/api/fixtures/landing-page";
    await page.fill('[data-testid="import-url-input"]', fixtureUrl);

    // Start Capture
    await page.click('[data-testid="import-start-btn"]');

    // Verify progress appears
    await expect(page.locator('[data-testid="import-progress-container"]')).toBeVisible({ timeout: 5000 });

    // Wait for review container to appear upon capture completion
    const reviewContainer = page.locator('[data-testid="import-review-container"]');
    await expect(reviewContainer).toBeVisible({ timeout: 40000 });

    // Verify Review Modal Components
    await expect(page.locator('[data-testid="import-screenshot-preview"]')).toBeVisible();
    await expect(page.locator('[data-testid="import-token-table"]')).toBeVisible();

    // Switch to DESIGN.md tab
    await page.click('button[role="tab"]:has-text("DESIGN.md")');
    const markdownPre = page.locator('[data-testid="import-design-markdown"] pre');
    await expect(markdownPre).toBeVisible();
    await expect(markdownPre).toContainText("Design System Specification");
    await expect(markdownPre).toContainText("version: \"1.0\"");

    // Switch to Assets tab
    await page.click('button[role="tab"]:has-text("Assets")');
    await expect(page.locator('[data-testid="import-asset-manifest"]')).toBeVisible();

    // Switch to Structure tab
    await page.click('button[role="tab"]:has-text("Structure")');
    await expect(page.locator("text=Scale Your Workflows Instantly")).toBeVisible();

    // Confirm Import into Editor
    await page.click('[data-testid="btn-confirm-import"]');

    // Verify dialog closes
    await expect(dialog).not.toBeVisible();

    // Verify imported document rendered in Editor
    // Layers panel should now include Acme Cloud elements
    const layers = page.locator('[data-testid="layers-panel"]');
    await expect(layers).toBeVisible();
    await expect(layers).toContainText("header");
    await expect(layers).toContainText("main");

    // Test selection works on imported elements
    const headerLayer = page.locator('[data-layer-id]:has-text("header")').first();
    await expect(headerLayer).toBeVisible();
    await headerLayer.click();

    // Properties panel should display selected header
    const propPanel = page.locator('[data-testid="properties-panel"]');
    await expect(propPanel).toBeVisible();
    await expect(propPanel).toContainText("header");

    // Test Atomic Undo: Single Undo reverts back to original landing page
    const undoButton = page.locator('[data-testid="toolbar-btn-undo"]');
    await expect(undoButton).toBeEnabled();
    await undoButton.click();

    // Verify original landing page elements are back
    await expect(layers).toContainText("main");
    const iframe = page.frameLocator('iframe[data-testid="preview-iframe"]');
    await expect(iframe.locator("body")).toBeVisible();

    // Test Redo restores imported page
    const redoButton = page.locator('[data-testid="toolbar-btn-redo"]');
    await expect(redoButton).toBeEnabled();
    await redoButton.click();

    // Imported page header is back
    await expect(layers).toContainText("header");
  });
});

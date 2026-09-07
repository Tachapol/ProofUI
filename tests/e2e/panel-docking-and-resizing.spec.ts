import { test, expect } from "@playwright/test";

test.describe("Panel Docking, Collapsing and Resizing (Layers, Ask AI, Right Sidebar / UX Analyzer)", () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to start with clean state
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('[data-layer-id="body-root"]', { timeout: 15000 });
  });

  test("Layers Panel can be resized and toggled (header btn, rail btn, toolbar btn)", async ({ page }) => {
    const layersPanel = page.locator('[data-testid="layers-panel"]');
    const layersCollapsedRail = page.locator('[data-testid="layers-panel-collapsed"]');
    const toolbarLayersBtn = page.locator('[data-testid="toolbar-btn-layers"]');
    const headerCollapseBtn = page.locator('[data-testid="layers-collapse-btn"]');

    // 1. Initially Layers panel is open
    await expect(layersPanel).toBeVisible();
    await expect(layersCollapsedRail).toBeHidden();

    // 2. Resize layers panel wider via drag handle
    const resizer = page.locator('[data-testid="layers-panel-resizer"]');
    await expect(resizer).toBeVisible();

    const initialBox = await layersPanel.boundingBox();
    expect(initialBox).not.toBeNull();

    const resizerBox = await resizer.boundingBox();
    expect(resizerBox).not.toBeNull();

    await page.mouse.move(resizerBox!.x + resizerBox!.width / 2, resizerBox!.y + 100);
    await page.mouse.down();
    await page.mouse.move(resizerBox!.x + 70, resizerBox!.y + 100, { steps: 5 });
    await page.mouse.up();

    const resizedBox = await layersPanel.boundingBox();
    expect(resizedBox!.width).toBeGreaterThan(initialBox!.width + 30);

    // 3. Collapse via header collapse button
    await headerCollapseBtn.click();
    await expect(layersPanel).toBeHidden();
    await expect(layersCollapsedRail).toBeVisible();

    // 4. Expand via rail button
    const railExpandBtn = page.locator('[data-testid="layers-expand-btn"]');
    await railExpandBtn.click();
    await expect(layersPanel).toBeVisible();
    await expect(layersCollapsedRail).toBeHidden();

    // 5. Toggle close and open via Toolbar Layers button
    await toolbarLayersBtn.click();
    await expect(layersPanel).toBeHidden();
    await expect(layersCollapsedRail).toBeVisible();

    await toolbarLayersBtn.click();
    await expect(layersPanel).toBeVisible();
    await expect(layersCollapsedRail).toBeHidden();
  });

  test("Right Sidebar (Properties & UX Analyzer) can be resized and toggled", async ({ page }) => {
    const rightSidebar = page.locator('[data-testid="right-sidebar-container"]');
    const rightSidebarCollapsedRail = page.locator('[data-testid="right-sidebar-collapsed"]');
    const headerCollapseBtn = page.locator('[data-testid="right-sidebar-collapse-btn"]');
    const toolbarAnalyzeBtn = page.locator('[data-testid="toolbar-btn-analyze-ux"]');

    // 1. Initially Right Sidebar is open
    await expect(rightSidebar).toBeVisible();
    await expect(rightSidebarCollapsedRail).toBeHidden();

    // 2. Resize right sidebar wider (dragging left handle to the left increases width)
    const resizer = page.locator('[data-testid="right-sidebar-resizer"]');
    await expect(resizer).toBeVisible();

    const initialBox = await rightSidebar.boundingBox();
    expect(initialBox).not.toBeNull();

    const resizerBox = await resizer.boundingBox();
    expect(resizerBox).not.toBeNull();

    await page.mouse.move(resizerBox!.x + resizerBox!.width / 2, resizerBox!.y + 100);
    await page.mouse.down();
    await page.mouse.move(resizerBox!.x - 70, resizerBox!.y + 100, { steps: 5 });
    await page.mouse.up();

    const resizedBox = await rightSidebar.boundingBox();
    expect(resizedBox!.width).toBeGreaterThan(initialBox!.width + 30);

    // 3. Collapse via header collapse button
    await headerCollapseBtn.click();
    await expect(rightSidebar).toBeHidden();
    await expect(rightSidebarCollapsedRail).toBeVisible();

    // 4. Expand directly to UX Analyzer via rail button
    const railOptBtn = page.locator('[data-testid="right-sidebar-expand-optimization-btn"]');
    await railOptBtn.click();
    await expect(rightSidebar).toBeVisible();
    await expect(page.locator('[data-testid="optimization-panel"]')).toBeVisible();

    // 5. Toggle via Toolbar Analyze UX button (when active on UX Analyzer, clicking toggles close)
    await toolbarAnalyzeBtn.click();
    await expect(rightSidebar).toBeHidden();
    await expect(rightSidebarCollapsedRail).toBeVisible();

    // 6. Clicking Toolbar Analyze UX button when closed opens UX Analyzer
    await toolbarAnalyzeBtn.click();
    await expect(rightSidebar).toBeVisible();
    await expect(page.locator('[data-testid="optimization-panel"]')).toBeVisible();

    // 7. Switch to Properties tab and check Properties panel is visible
    await page.locator('[data-testid="tab-properties"]').click();
    await expect(page.locator('[data-testid="properties-panel"]')).toBeVisible();
  });

  test("Ask AI panel toggles open/close from Toolbar", async ({ page }) => {
    const chatSidebar = page.locator('[data-testid="ai-composer-panel"]');
    const askAiBtn = page.locator('[data-testid="toolbar-btn-ask-ai"]');

    // Initially collapsed
    await expect(chatSidebar).toBeHidden();

    // Click to open
    await askAiBtn.click();
    await expect(chatSidebar).toBeVisible();

    // Click to toggle close
    await askAiBtn.click();
    await expect(chatSidebar).toBeHidden();

    // Click to open again
    await askAiBtn.click();
    await expect(chatSidebar).toBeVisible();
  });
});

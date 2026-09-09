import { test, expect } from "@playwright/test";

test.describe("Custom Frame Dimensions and Pixel Resizing", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('[data-layer-id="body-root"]', { timeout: 15000 });
  });

  test("proves desktop default 1440 x 1024, stepper buttons, direct inputs, and drag resizing", async ({
    page,
  }) => {
    // 1. Verify Frame Dimension indicator on Top Bar defaults to 1440 × 1024 px
    const dimensionBadge = page.locator('[data-testid="frame-dimension-indicator"]');
    await expect(dimensionBadge).toBeVisible();
    await expect(dimensionBadge).toContainText("1440 × 1024 px");

    // 2. Verify Frame container style and bounding box
    const frameContainer = page.locator('[data-testid="viewport-frame-container"]');
    await expect(frameContainer).toBeVisible();

    const initialBox = await frameContainer.boundingBox();
    expect(initialBox).not.toBeNull();
    expect(Math.round(initialBox!.width)).toBe(1440);
    expect(Math.round(initialBox!.height)).toBe(1024);

    // 3. Verify Toolbar inputs match
    const widthInput = page.locator('[data-testid="frame-width-input"]');
    const heightInput = page.locator('[data-testid="frame-height-input"]');
    await expect(widthInput).toHaveValue("1440");
    await expect(heightInput).toHaveValue("1024");

    // 4. Test Increment / Decrement Steppers (+ and -)
    const increaseWidthBtn = page.locator('[data-testid="btn-increase-width"]');
    const decreaseWidthBtn = page.locator('[data-testid="btn-decrease-width"]');
    const increaseHeightBtn = page.locator('[data-testid="btn-increase-height"]');
    const decreaseHeightBtn = page.locator('[data-testid="btn-decrease-height"]');

    // Increase width by 1px
    await increaseWidthBtn.click();
    await expect(widthInput).toHaveValue("1441");
    await expect(dimensionBadge).toContainText("1441 × 1024 px");

    // Decrease width by 1px
    await decreaseWidthBtn.click();
    await expect(widthInput).toHaveValue("1440");

    // Increase height by 1px
    await increaseHeightBtn.click();
    await expect(heightInput).toHaveValue("1025");
    await expect(dimensionBadge).toContainText("1440 × 1025 px");

    // Decrease height by 1px
    await decreaseHeightBtn.click();
    await expect(heightInput).toHaveValue("1024");

    // 5. Test direct numeric input
    await widthInput.fill("1200");
    await expect(dimensionBadge).toContainText("1200 × 1024 px");

    await heightInput.fill("850");
    await expect(dimensionBadge).toContainText("1200 × 850 px");

    await expect(frameContainer).toHaveCSS("width", "1200px");
    const updatedBox = await frameContainer.boundingBox();
    expect(Math.round(updatedBox!.width)).toBe(1200);
    expect(Math.round(updatedBox!.height)).toBe(850);

    // 6. Test Reset to Default
    const resetBtn = page.locator('[data-testid="btn-reset-frame-size"]');
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();

    await expect(widthInput).toHaveValue("1440");
    await expect(heightInput).toHaveValue("1024");
    await expect(dimensionBadge).toContainText("1440 × 1024 px");

    // 7. Test Drag Resize Handle on the right edge
    // Collapse right sidebar so 768px tablet canvas has plenty of unobstructed space in 1280px browser window
    const collapseRightSidebarBtn = page.locator('[data-testid="right-sidebar-collapse-btn"]');
    if (await collapseRightSidebarBtn.isVisible()) {
      await collapseRightSidebarBtn.click();
    }
    const tabletBtn = page.locator('[data-testid="viewport-tablet"]');
    await tabletBtn.click();
    await page.waitForTimeout(300);

    const rightHandle = page.locator('[data-testid="frame-resize-handle-right"]');
    await expect(rightHandle).toBeVisible();

    const handleBox = await rightHandle.boundingBox();
    expect(handleBox).not.toBeNull();

    const startX = handleBox!.x + handleBox!.width / 2;
    const startY = handleBox!.y + 100;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 60, startY, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    const draggedBox = await frameContainer.boundingBox();
    expect(Math.round(draggedBox!.width)).toBeGreaterThan(800);
  });
});

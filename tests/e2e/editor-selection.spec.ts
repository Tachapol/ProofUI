import { test, expect } from "@playwright/test";

test.describe("Visual HTML Editor - Bidirectional Selection & Viewports", () => {
  test("proves bidirectional selection between iframe and Layers panel, and viewport controls", async ({
    page,
  }) => {
    // 1. Navigate to editor shell
    await page.goto("/");

    // 2. Wait for iframe and layers panel to load
    const iframeElement = page.locator('iframe[data-testid="preview-iframe"]');
    await expect(iframeElement).toBeVisible();

    const layersPanel = page.locator('[data-testid="layers-panel"]');
    await expect(layersPanel).toBeVisible();

    // Wait for the tree to be populated
    await page.waitForSelector('[data-layer-id="body-root"]', { timeout: 15000 });

    const frame = page.frameLocator('iframe[data-testid="preview-iframe"]');

    // -------------------------------------------------------------
    // Test 1: Selection from Iframe -> Layers Panel
    // -------------------------------------------------------------
    const heroSubtitleInIframe = frame.locator('[data-editor-id="hero-subtitle"]');
    await expect(heroSubtitleInIframe).toBeVisible();

    // Click hero subtitle inside iframe
    await heroSubtitleInIframe.click();

    // Verify parent selection outline appears
    const selectionOutline = page.locator('[data-testid="selection-outline"]');
    await expect(selectionOutline).toBeVisible();

    // Verify outline contains tag info <p
    await expect(selectionOutline).toContainText("<p");

    // Verify corresponding row in Layers panel is highlighted/selected
    const subtitleLayerRow = page.locator('[data-layer-id="hero-subtitle"]');
    await expect(subtitleLayerRow).toBeVisible();
    await expect(subtitleLayerRow).toHaveClass(/bg-indigo-600/);

    // -------------------------------------------------------------
    // Test 2: Selection from Layers Panel -> Iframe & Parent Outline
    // -------------------------------------------------------------
    // Select the "btn-get-started" button layer from the Layers panel
    const buttonLayerRow = page.locator('[data-layer-id="btn-get-started"]');
    await expect(buttonLayerRow).toBeVisible();
    await buttonLayerRow.click();

    // Verify selection outline updates to reflect <button>
    await expect(selectionOutline).toBeVisible();
    await expect(selectionOutline).toContainText("<button");

    // Verify button layer row now has active selection classes
    await expect(buttonLayerRow).toHaveClass(/bg-indigo-600/);

    // Verify former selection is no longer selected
    await expect(subtitleLayerRow).not.toHaveClass(/bg-indigo-600\/20/);

    // -------------------------------------------------------------
    // Test 3: Viewport Controls
    // -------------------------------------------------------------
    // Switch to Mobile (390px)
    const mobileBtn = page.locator('[data-testid="viewport-mobile"]');
    await mobileBtn.click();
    await page.waitForTimeout(400); // allow css transition

    const mobileFrameContainer = page.locator(".transition-\\[width\\]");
    const mobileBox = await mobileFrameContainer.boundingBox();
    expect(mobileBox).not.toBeNull();
    expect(Math.round(mobileBox!.width)).toBe(390);

    // Switch to Tablet (768px)
    const tabletBtn = page.locator('[data-testid="viewport-tablet"]');
    await tabletBtn.click();
    await page.waitForTimeout(400);

    const tabletBox = await mobileFrameContainer.boundingBox();
    expect(tabletBox).not.toBeNull();
    expect(Math.round(tabletBox!.width)).toBe(768);

    // Switch to Desktop
    const desktopBtn = page.locator('[data-testid="viewport-desktop"]');
    await desktopBtn.click();
    await page.waitForTimeout(400);

    const desktopBox = await mobileFrameContainer.boundingBox();
    expect(desktopBox).not.toBeNull();
    expect(desktopBox!.width).toBeGreaterThan(390);
    await expect(mobileFrameContainer).toHaveClass(/max-w-\[1440px\]/);
  });
});

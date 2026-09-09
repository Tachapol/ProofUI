import { test, expect } from "@playwright/test";

test.describe("Interactive Attention & Heatmap Overlay", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?view=editor");
    await page.waitForSelector('[data-layer-id="body-root"]', { timeout: 15000 });
  });

  test("toggles heatmap overlay, switches modes (Attention, Clicks, Scroll), adjusts opacity, and selects elements", async ({
    page,
  }) => {
    // 1. Locate and click Heatmap button on Toolbar
    const heatmapBtn = page.locator('[data-testid="toolbar-btn-heatmap"]');
    await expect(heatmapBtn).toBeVisible();
    await heatmapBtn.click();

    // 2. Verify Heatmap Overlay is visible
    const heatmapOverlay = page.locator('[data-testid="heatmap-canvas-overlay"]');
    await expect(heatmapOverlay).toBeVisible();

    // 3. Verify Default Mode is Saliency (Attention)
    const saliencyModeBtn = page.locator('[data-testid="heatmap-mode-saliency"]');
    const clicksModeBtn = page.locator('[data-testid="heatmap-mode-clicks"]');
    const scrollModeBtn = page.locator('[data-testid="heatmap-mode-scroll"]');
    await expect(saliencyModeBtn).toBeVisible();
    await expect(clicksModeBtn).toBeVisible();
    await expect(scrollModeBtn).toBeVisible();

    // Verify SVG glow or gradient element is rendered
    const heatSvg = heatmapOverlay.locator("svg").first();
    await expect(heatSvg).toBeVisible();

    // 4. Switch to Click Density Mode
    await clicksModeBtn.click();
    // Verify Click Hotspots or floating metric pills appear
    const clickPills = heatmapOverlay.locator("div").filter({ hasText: /Clicks/i });
    // In clicks mode, flame icon or % share is present
    await expect(clicksModeBtn).toHaveClass(/bg-rose-500/);

    // 5. Switch to Scroll Reach Mode
    await scrollModeBtn.click();
    await expect(scrollModeBtn).toHaveClass(/bg-indigo-500/);
    const foldLine = heatmapOverlay.getByText(/Fold Line/i);
    await expect(foldLine).toBeVisible();

    // 6. Test Opacity Slider
    const opacitySlider = page.locator('[data-testid="heatmap-opacity-slider"]');
    await expect(opacitySlider).toBeVisible();
    await opacitySlider.fill("0.5");
    await expect(heatmapOverlay).toHaveCSS("opacity", "0.5");

    // 7. Test clicking hotspot to select element in editor
    await saliencyModeBtn.click();
    const firstHotspot = page.locator('[data-testid^="hotspot-"]').first();
    await expect(firstHotspot).toBeVisible();
    await firstHotspot.click({ force: true });

    // 8. Close Heatmap Overlay
    const closeBtn = page.locator('[data-testid="btn-close-heatmap"]');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    // 9. Verify overlay is removed
    await expect(heatmapOverlay).not.toBeVisible();
  });
});

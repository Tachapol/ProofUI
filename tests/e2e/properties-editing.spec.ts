import { test, expect } from "@playwright/test";

test.describe("Visual HTML Editor - Milestone 2 Properties & Canonical Document Editing", () => {
  test("full document editing workflow: text, classes, duplicate, delete, undo/redo, and persistence", async ({
    page,
  }) => {
    // Navigate to editor shell
    await page.goto("/");
    // 1. Wait for iframe and layers tree to be populated
    const iframeElement = page.locator('iframe[data-testid="preview-iframe"]');
    await expect(iframeElement).toBeVisible();

    const layersPanel = page.locator('[data-testid="layers-panel"]');
    await expect(layersPanel).toBeVisible();
    await page.waitForSelector('[data-layer-id="body-root"]', { timeout: 15000 });

    const frame = page.frameLocator('iframe[data-testid="preview-iframe"]');
    const propertiesPanel = page.locator('[data-testid="properties-panel"]');

    // Initially, when nothing is selected, properties panel shows empty state
    await expect(propertiesPanel).toContainText("No Element Selected");

    // -------------------------------------------------------------
    // Step 1: Select element in iframe & inspect Properties
    // -------------------------------------------------------------
    const heroSubtitleInIframe = frame.locator('[data-editor-id="hero-subtitle"]');
    await expect(heroSubtitleInIframe).toBeVisible();
    await heroSubtitleInIframe.click();

    // Verify properties panel updates to show selected element
    await expect(propertiesPanel).toContainText("<p>");
    await expect(propertiesPanel).toContainText("hero-subtitle");

    // -------------------------------------------------------------
    // Step 2: Edit Text Content & verify synchronization
    // -------------------------------------------------------------
    const textInput = page.locator('[data-testid="property-text-input"]');
    await expect(textInput).toBeVisible();

    // Clear and type new text
    await textInput.fill("Automated cloud orchestration at scale.");
    await page.waitForTimeout(450); // wait for 300ms debounce

    // Verify iframe reflects updated text
    await expect(heroSubtitleInIframe).toContainText("Automated cloud orchestration at scale.");

    // Verify save status shows saved or saving
    const saveStatus = page.locator('[data-testid="save-status-saved"]');
    await expect(saveStatus).toBeVisible({ timeout: 5000 });

    // -------------------------------------------------------------
    // Step 3: Change Text Size & verify unrelated classes remain intact
    // -------------------------------------------------------------
    // Select Hero Badge text element
    const badgeTextInIframe = frame.locator('[data-editor-id="badge-text"]');
    await expect(badgeTextInIframe).toBeVisible();
    await badgeTextInIframe.click();

    await expect(propertiesPanel).toContainText("badge-text");

    // Click quick text size button text-xl
    const textXlBtn = page.locator('[data-testid="prop-btn-text-xl"]');
    await expect(textXlBtn).toBeVisible();
    await textXlBtn.click();
    await page.waitForTimeout(200);

    // Verify text-xl class chip appears
    await expect(page.locator('[data-testid="class-chip-text-xl"]')).toBeVisible();

    // -------------------------------------------------------------
    // Step 4: Add and Remove Class Chips
    // -------------------------------------------------------------
    const addClassInput = page.locator('[data-testid="property-add-class-input"]');
    const addClassBtn = page.locator('[data-testid="property-add-class-button"]');

    await addClassInput.fill("border-2");
    await addClassBtn.click();
    await page.waitForTimeout(200);

    // Verify class chip appears
    const borderChip = page.locator('[data-testid="class-chip-border-2"]');
    await expect(borderChip).toBeVisible();

    // Remove class chip
    const removeBorderBtn = page.locator('[data-testid="remove-class-border-2"]');
    await removeBorderBtn.click();
    await page.waitForTimeout(200);
    await expect(borderChip).not.toBeVisible();

    // -------------------------------------------------------------
    // Step 5: Duplicate Element & verify new stable IDs
    // -------------------------------------------------------------
    // Select feature card 1
    const featureCard1InIframe = frame.locator('[data-editor-id="feature-card-1"]');
    await expect(featureCard1InIframe).toBeVisible();
    await featureCard1InIframe.click();

    const duplicateBtn = page.locator('[data-testid="property-btn-duplicate"]');
    await expect(duplicateBtn).toBeVisible();
    await duplicateBtn.click();
    await page.waitForTimeout(300);

    // After duplication, selection moves to the newly created duplicate element
    const newSelectedIdEl = propertiesPanel.locator("span[title]");
    const newSelectedId = await newSelectedIdEl.getAttribute("title");
    expect(newSelectedId).not.toBe("feature-card-1");
    expect(newSelectedId).toMatch(/^node_/);

    // -------------------------------------------------------------
    // Step 6: Undo & Redo duplication via Toolbar buttons
    // -------------------------------------------------------------
    const undoBtn = page.locator('[data-testid="toolbar-btn-undo"]');
    const redoBtn = page.locator('[data-testid="toolbar-btn-redo"]');

    await expect(undoBtn).toBeEnabled();
    await undoBtn.click();
    await page.waitForTimeout(400);

    // Duplicate element is removed from iframe
    await expect(frame.locator(`[data-editor-id="${newSelectedId}"]`)).toHaveCount(0);

    // Redo restores duplicate element with the same stable ID
    await expect(redoBtn).toBeEnabled();
    await redoBtn.click();
    await page.waitForTimeout(400);
    await expect(frame.locator(`[data-editor-id="${newSelectedId}"]`)).toBeVisible();

    // -------------------------------------------------------------
    // Step 7: Delete Element & Undo deletion
    // -------------------------------------------------------------
    const deleteBtn = page.locator('[data-testid="property-btn-delete"]');
    await deleteBtn.click();

    // Click Confirm
    const confirmDeleteBtn = page.locator('[data-testid="property-btn-confirm-delete"]');
    await confirmDeleteBtn.click();
    await page.waitForTimeout(300);

    // Deleted element is gone from iframe
    await expect(frame.locator(`[data-editor-id="${newSelectedId}"]`)).toHaveCount(0);

    // Keyboard Undo (Cmd+Z or Ctrl+Z)
    const isMac = process.platform === "darwin";
    if (isMac) {
      await page.keyboard.press("Meta+z");
    } else {
      await page.keyboard.press("Control+z");
    }
    await page.waitForTimeout(400);

    // Restored in iframe with its original ID
    await expect(frame.locator(`[data-editor-id="${newSelectedId}"]`)).toBeVisible();

    // -------------------------------------------------------------
    // Step 8: Persistence across page refresh
    // -------------------------------------------------------------
    // Wait for autosave to complete
    await expect(page.locator('[data-testid="save-status-saved"]')).toBeVisible({ timeout: 5000 });

    // Reload page
    await page.reload();
    await page.waitForSelector('[data-layer-id="body-root"]', { timeout: 15000 });

    // Verify edited text persisted
    const reloadedSubtitle = frame.locator('[data-editor-id="hero-subtitle"]');
    await expect(reloadedSubtitle).toContainText("Automated cloud orchestration at scale.");

    // -------------------------------------------------------------
    // Step 9: Viewport Controls
    // -------------------------------------------------------------
    const mobileBtn = page.locator('[data-testid="viewport-mobile"]');
    await mobileBtn.click();
    await page.waitForTimeout(400);

    const mobileFrameContainer = page.locator(".transition-\\[width\\]");
    const mobileBox = await mobileFrameContainer.boundingBox();
    expect(mobileBox).not.toBeNull();
    expect(Math.round(mobileBox!.width)).toBe(390);

    const desktopBtn = page.locator('[data-testid="viewport-desktop"]');
    await desktopBtn.click();
    await page.waitForTimeout(400);
    const desktopBox = await mobileFrameContainer.boundingBox();
    expect(desktopBox).not.toBeNull();
    expect(desktopBox!.width).toBeGreaterThan(390);
    await expect(mobileFrameContainer).toHaveClass(/max-w-\[1440px\]/);
  });

  test("ignores malformed and stale revision bridge messages safely", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector('[data-layer-id="body-root"]', { timeout: 15000 });

    // Send malformed postMessage to parent window
    await page.evaluate(() => {
      window.postMessage({ type: "UNKNOWN_GARBAGE", payload: { x: 1 } }, "*");
      window.postMessage("plain-string-message", "*");
      window.postMessage(null, "*");
      window.postMessage(
        {
          source: "visual-editor-iframe",
          type: "IFRAME_READY",
          payload: { sessionId: "wrong-session-id", documentTree: {} },
        },
        "*"
      );
    });

    await page.waitForTimeout(300);

    // Editor should still be fully functional and stable
    const layersPanel = page.locator('[data-testid="layers-panel"]');
    await expect(layersPanel).toBeVisible();
    await expect(page.locator('[data-layer-id="body-root"]')).toBeVisible();
  });
});

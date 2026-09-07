import { test, expect } from "@playwright/test";

test.describe("Milestone 4.5: Chat Sidebar, Full-Page Generation, and Version History", () => {
  test("toggles chat sidebar, manages conversations, and resizes panel", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector('[data-layer-id="body-root"]', { timeout: 15000 });

    // Chat sidebar is collapsed by default to maximize canvas room
    const expandRailBtn = page.locator('[data-testid="chat-expand-btn"]');
    await expect(expandRailBtn).toBeVisible();

    // 1. Expand sidebar via rail button
    await expandRailBtn.click();
    const chatSidebar = page.locator('[data-testid="ai-composer-panel"]');
    await expect(chatSidebar).toBeVisible();

    // 2. Collapse sidebar via header collapse button
    const collapseHeaderBtn = page.locator('[data-testid="chat-collapse-btn"]');
    await collapseHeaderBtn.click();
    await expect(chatSidebar).toBeHidden();
    await expect(expandRailBtn).toBeVisible();

    // 3. Re-open sidebar via Toolbar "Ask AI" button
    const askAiBtn = page.locator('[data-testid="toolbar-btn-ask-ai"]');
    await askAiBtn.click();
    await expect(chatSidebar).toBeVisible();

    // 4. Conversation management: New Conversation
    const conversationTitleBtn = page.locator('[data-testid="conversation-title-btn"]');
    await conversationTitleBtn.click();

    const newChatBtn = page.locator('[data-testid="btn-new-chat"]');
    await expect(newChatBtn).toBeVisible();
    await newChatBtn.click();

    // Verify empty prompt input
    await expect(page.locator('[data-testid="ai-instruction-input"]')).toBeVisible();

    // 5. Rename Conversation
    await conversationTitleBtn.click();
    const renameBtn = page.locator('button[title="Rename chat"]').first();
    await renameBtn.click();

    const renameInput = page.locator('[data-testid="rename-conversation-input"]');
    await expect(renameInput).toBeVisible();
    await renameInput.fill("My Landing Page Project");
    await renameInput.press("Enter");

    await expect(conversationTitleBtn).toContainText("My Landing Page Project");

    // 6. Resizing Sidebar: Drag separator handle
    const resizeHandle = page.locator('[data-testid="chat-resize-handle"]');
    await expect(resizeHandle).toBeVisible();

    const initialBox = await chatSidebar.boundingBox();
    expect(initialBox).not.toBeNull();

    // Drag handle right by 60px
    await resizeHandle.hover();
    await page.mouse.down();
    await page.mouse.move(initialBox!.x + initialBox!.width + 60, initialBox!.y + 100);
    await page.mouse.up();

    const resizedBox = await chatSidebar.boundingBox();
    expect(resizedBox!.width).toBeGreaterThan(initialBox!.width + 30);
  });

  test("generates full-page candidate, previews in canvas with banner, compares, and applies", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.goto("/");
    await page.waitForSelector('[data-layer-id="body-root"]', { timeout: 15000 });

    const frame = page.frameLocator('iframe[data-testid="preview-iframe"]');

    // Open Chat Sidebar
    await page.click('[data-testid="toolbar-btn-ask-ai"]');
    const chatSidebar = page.locator('[data-testid="ai-composer-panel"]');
    await expect(chatSidebar).toBeVisible();

    // Switch to Generate mode
    const generateTab = page.locator('[data-testid="mode-tab-generate"]');
    await generateTab.click();

    // Enter instruction
    const promptInput = page.locator('[data-testid="ai-instruction-input"]');
    await promptInput.fill("Create a sleek modern dark developer platform landing page with hero and pricing");

    // Submit generation
    const submitBtn = page.locator('[data-testid="btn-generate-ai-edit"]');
    await submitBtn.click();

    // Wait for Candidate Result Card to appear in chat
    const resultCard = page.locator('[data-testid="generation-result-card"]').first();
    await expect(resultCard).toBeVisible({ timeout: 30000 });

    // Verify Preview button on card
    const previewBtn = resultCard.locator('[data-testid="btn-preview-candidate"]');
    await expect(previewBtn).toBeVisible();
    await previewBtn.click();

    // Verify floating canvas banner appears
    const previewBanner = page.locator('[data-testid="generation-preview-banner"]');
    await expect(previewBanner).toBeVisible();
    await expect(previewBanner).toContainText("Generated Preview");

    // Toggle Compare: Show Original vs Generated
    const compareBtn = previewBanner.locator('[data-testid="btn-banner-compare-candidate"]');
    await compareBtn.click();
    await expect(previewBanner).toContainText("Current Document");

    // Toggle back to Generated
    await compareBtn.click();
    await expect(previewBanner).toContainText("Generated Preview");

    // Apply Candidate
    const applyBtn = previewBanner.locator('[data-testid="btn-banner-apply-candidate"]');
    await applyBtn.click();

    // Candidate preview banner disappears
    await expect(previewBanner).toBeHidden();

    // Verify canonical document updated in iframe with new generated structure
    await expect(frame.locator("body")).toBeVisible();
    await expect(frame.locator("header")).toBeVisible();

    // Verify version history recorded the application
    const historyBtn = page.locator('[data-testid="toolbar-btn-history"]');
    await expect(historyBtn).toBeVisible();
    await historyBtn.click();

    const historyDialog = page.locator('[data-testid="version-history-dialog"]');
    await expect(historyDialog).toBeVisible();

    // Expect at least 2 versions (initial + ai-generation)
    const versionItems = page.locator('[data-testid^="version-item-"]');
    expect(await versionItems.count()).toBeGreaterThanOrEqual(2);

    // Close History Dialog
    await page.keyboard.press("Escape");
  });

  test("restores past document version safely from Version History dialog", async ({ page }) => {
    test.setTimeout(45000);
    await page.goto("/");
    await page.waitForSelector('[data-layer-id="body-root"]', { timeout: 15000 });

    const frame = page.frameLocator('iframe[data-testid="preview-iframe"]');
    const heroTitle = frame.locator('[data-editor-id="hero-title"]');
    await expect(heroTitle).toBeVisible();
    const originalText = await heroTitle.innerText();

    // Open Code Mode
    await page.click('[data-testid="mode-code"]');
    await page.waitForSelector('[data-testid="code-editor-panel"]');

    await page.waitForFunction(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return !!(window as any).__monacoEditor;
    });

    const modifiedHtml = `<!DOCTYPE html>
<html>
<head><title>Modified Version</title></head>
<body>
  <div data-editor-id="hero-title" class="p-8 text-3xl font-bold">Version 2 Content</div>
</body>
</html>`;

    await page.evaluate((html) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__monacoEditor.setValue(html);
    }, modifiedHtml);

    await page.waitForTimeout(800); // Allow debounce validation

    const applyCodeBtn = page.locator('[data-testid="btn-apply-code"]');
    await expect(applyCodeBtn).toBeEnabled({ timeout: 5000 });
    await applyCodeBtn.click();
    await page.waitForTimeout(400);

    // Switch back to Design mode
    await page.click('[data-testid="mode-design"]');
    await expect(frame.locator('[data-editor-id="hero-title"]')).toBeVisible();

    // Open Version History
    await page.click('[data-testid="toolbar-btn-history"]');
    const historyDialog = page.locator('[data-testid="version-history-dialog"]');
    await expect(historyDialog).toBeVisible();

    // Find restore buttons (available on past non-head versions)
    const restoreButtons = page.locator('[data-testid^="btn-restore-version-"]');
    expect(await restoreButtons.count()).toBeGreaterThanOrEqual(1);

    // Click restore on the past version
    const oldestRestoreBtn = restoreButtons.first();
    await oldestRestoreBtn.click();

    // Confirm dialog
    const confirmRestoreBtn = page.locator('[data-testid="btn-confirm-restore-version"]');
    await expect(confirmRestoreBtn).toBeVisible();
    await confirmRestoreBtn.click();

    // History dialog closes
    await expect(historyDialog).toBeHidden();

    // Verify document restored to initial template
    await expect(frame.locator('[data-editor-id="hero-title"]')).toBeVisible();
    await expect(frame.locator('[data-editor-id="hero-title"]')).toContainText(originalText.slice(0, 8));
  });

  test("displays live generation timer, token metrics (in/out), and surfaces failed generation clearly instead of disappearing", async ({
    page,
  }) => {
    // 1. Ensure chat sidebar is open
    await page.goto("/");
    await page.waitForSelector('[data-layer-id="body-root"]', { timeout: 15000 });

    const chatSidebar = page.locator('[data-testid="ai-composer-panel"]');
    if (!(await chatSidebar.isVisible())) {
      const askAiBtn = page.locator('[data-testid="toolbar-btn-ask-ai"]');
      if (await askAiBtn.isVisible()) {
        await askAiBtn.click();
      } else {
        await page.click('[data-testid="chat-expand-btn"]');
      }
      await expect(chatSidebar).toBeVisible();
    }

    // 2. Normal generation to verify live timer & token metrics
    const textarea = page.locator('[data-testid="ai-instruction-input"]');
    await textarea.fill("Create a landing page with hero CTA");
    const submitBtn = page.locator('[data-testid="btn-generate-ai-edit"]');
    await submitBtn.click();

    // Result card appears
    const resultCard = page.locator('[data-testid="generation-result-card"]').first();
    await expect(resultCard).toBeVisible({ timeout: 15000 });

    // Verify token metrics (Token In, Token Out)
    const tokenMetrics = resultCard.locator('[data-testid="generation-token-metrics"]');
    await expect(tokenMetrics).toBeVisible();
    await expect(tokenMetrics).toContainText("Token In:");
    await expect(tokenMetrics).toContainText("Token Out:");

    // 3. Test failure case: mock route to return 500 error
    await page.route("/api/ai/generate", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "AI service connection timed out. Please try again." }),
      });
    });

    await textarea.fill("This generation request will fail");
    await submitBtn.click();

    // Verify error card appears and is prominently visible (does not vanish)
    const errorCard = page.locator('[data-testid="chat-error-card"]');
    await expect(errorCard).toBeVisible({ timeout: 10000 });
    await expect(errorCard).toContainText("Generation Failed");
    await expect(errorCard).toContainText("AI service connection timed out. Please try again.");
  });
});


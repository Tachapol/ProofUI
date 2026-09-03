import { test, expect } from "@playwright/test";

test.describe("Visual HTML Editor - Milestone 3 Code Mode", () => {
  test("edits code draft, validates diagnostics, applies valid changes, and preserves IDs", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForSelector('[data-layer-id="body-root"]', { timeout: 15000 });

    const frame = page.frameLocator('iframe[data-testid="preview-iframe"]');
    const heroTitleInIframe = frame.locator('[data-editor-id="hero-title"]');
    await expect(heroTitleInIframe).toContainText("Scale your infrastructure");

    // 1. Switch to Code Mode
    const codeModeBtn = page.locator('[data-testid="mode-code"]');
    await codeModeBtn.click();

    // Verify Code Editor panel is visible
    const codePanel = page.locator('[data-testid="code-editor-panel"]');
    await expect(codePanel).toBeVisible();

    // Monaco editor container
    const monacoInput = page.getByRole("textbox", { name: "Editor content" });
    await expect(monacoInput).toBeAttached({ timeout: 15000 });

    // 2. Test Invalid HTML Diagnostics without affecting canonical source
    await page.waitForFunction(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return !!(window as any).__monacoEditor;
    });

    // Set malformed HTML with an inline event handler and duplicate ID
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__monacoEditor.setValue(
        '<!DOCTYPE html><html><body data-editor-id="node_dup"><div data-editor-id="node_dup" onclick="alert(1)">Malformed Code Draft</div></body></html>'
      );
    });
    await page.waitForTimeout(800); // allow debounce validation

    // Verify invalid status and diagnostics appear
    const statusInvalid = page.locator('[data-testid="code-status-invalid"]');
    await expect(statusInvalid).toBeVisible();

    const diagnosticsPanel = page.locator('[data-testid="code-diagnostics-panel"]');
    await expect(diagnosticsPanel).toContainText("Duplicate data-editor-id detected");
    await expect(diagnosticsPanel).toContainText('Inline event handler "onclick" is forbidden');

    // "Apply Code Changes" button must be disabled
    const applyBtn = page.locator('[data-testid="btn-apply-code"]');
    await expect(applyBtn).toBeDisabled();

    // 3. Switch back to Design mode to confirm last-valid preview remained pristine
    const designModeBtn = page.locator('[data-testid="mode-design"]');
    await designModeBtn.click();

    // Unapplied changes confirmation modal must appear
    const confirmDiscardBtn = page.locator('[data-testid="btn-confirm-discard-code"]');
    await expect(confirmDiscardBtn).toBeVisible();
    await confirmDiscardBtn.click();

    // Verify iframe still has original content
    await expect(heroTitleInIframe).toContainText("Scale your infrastructure");

    // 4. Switch back to Code Mode, make a clean valid edit and apply it
    await codeModeBtn.click();
    await expect(codePanel).toBeVisible();

    await page.waitForFunction(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return !!(window as any).__monacoEditor;
    });

    const validEditedHtml = `<!DOCTYPE html>
<html>
  <body data-editor-id="body-root">
    <main data-editor-id="main-content">
      <h1 data-editor-id="hero-title" class="text-5xl font-bold">Cloud Scale Redefined</h1>
      <p data-editor-id="hero-subtitle">Production-ready visual engineering.</p>
    </main>
  </body>
</html>`;

    await page.evaluate((val) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__monacoEditor.setValue(val);
    }, validEditedHtml);
    await page.waitForTimeout(800);

    // Verify apply button is enabled
    await expect(applyBtn).toBeEnabled({ timeout: 10000 });
    await applyBtn.click();
    await page.waitForTimeout(400);

    // 5. Switch to Design Mode and verify Canvas, Layers, and Properties reflect the code update
    await designModeBtn.click();

    await expect(heroTitleInIframe).toContainText("Cloud Scale Redefined");
    const layersPanel = page.locator('[data-testid="layers-panel"]');
    await expect(layersPanel).toContainText("Cloud Scale Redefined");

    // Click title to verify Properties panel displays it with preserved ID
    await heroTitleInIframe.click();
    const propertiesPanel = page.locator('[data-testid="properties-panel"]');
    await expect(propertiesPanel).toContainText("hero-title");

    // 6. Test Undo: reverts the code edit in a single history action
    const undoBtn = page.locator('[data-testid="toolbar-btn-undo"]');
    await expect(undoBtn).toBeEnabled();
    await undoBtn.click();
    await page.waitForTimeout(400);

    // Reverted back to original sample document
    await expect(heroTitleInIframe).toContainText("Scale your infrastructure");
  });
});

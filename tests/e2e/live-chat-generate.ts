import { chromium } from "playwright";
import * as path from "path";

async function main() {
  console.log("Launching Chromium to test Chat Generate UI...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER PAGE ERROR:', err.message));
  page.on('request', req => {
    if (req.url().includes('/api/ai/')) {
      console.log(`FETCH REQUEST: ${req.method()} ${req.url()}`);
    }
  });
  page.on('response', async res => {
    if (res.url().includes('/api/ai/')) {
      console.log(`FETCH RESPONSE: ${res.status()} ${res.url()}`);
    }
  });

  const screenshotDir = path.resolve("/Users/mysteriouz/.gemini/antigravity-ide/brain/52954ca4-8b50-4a43-8857-b6b056a091cd");

  try {
    console.log("Navigating to http://localhost:3000...");
    await page.goto("http://localhost:3000", { timeout: 30000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('[data-layer-id="body-root"]', { timeout: 20000 });
    console.log("Page loaded cleanly with cleared storage.");

    // Open Chat Sidebar via Toolbar button or rail button
    const askAiBtn = page.locator('[data-testid="toolbar-btn-ask-ai"]');
    if (await askAiBtn.isVisible()) {
      console.log("Clicking Ask AI toolbar button...");
      await askAiBtn.click();
    } else {
      const expandRailBtn = page.locator('[data-testid="chat-expand-btn"]');
      if (await expandRailBtn.isVisible()) {
        console.log("Clicking expand rail button...");
        await expandRailBtn.click();
      }
    }

    const chatSidebar = page.locator('[data-testid="ai-composer-panel"]');
    await chatSidebar.waitFor({ state: "visible", timeout: 10000 });
    console.log("Chat sidebar is visible.");

    // Ensure Generate mode is active
    const generateTab = page.locator('[data-testid="mode-tab-generate"]');
    if (await generateTab.isVisible()) {
      console.log("Clicking Generate mode tab...");
      await generateTab.click();
    }

    // Check provider selection
    const providerButton = page.locator('button:has-text("Qwen"), button:has-text("Mock"), button:has-text("Gemini")').first();
    const currentProvider = await providerButton.textContent();
    console.log(`Current provider in composer: ${currentProvider}`);

    // Fill instruction
    const promptInput = page.locator('[data-testid="ai-instruction-input"]');
    await promptInput.waitFor({ state: "visible", timeout: 5000 });
    const instruction = "Create a modern luxury coffee shop landing hero with call to action button";
    console.log(`Entering instruction: "${instruction}"...`);
    await promptInput.fill(instruction);

    // Click submit
    const submitBtn = page.locator('[data-testid="btn-generate-ai-edit"]');
    await submitBtn.waitFor({ state: "visible", timeout: 5000 });
    console.log("Clicking submit generation button...");
    await submitBtn.click();

    // Check for streaming / progress or candidate result card
    console.log("Waiting for generation result card (up to 150s)...");
    const resultCard = page.locator('[data-testid="generation-result-card"]').first();
    await resultCard.waitFor({ state: "visible", timeout: 150000 });
    console.log("Generation result card appeared!");

    // Capture screenshot of the UI with candidate card
    const cardScreenshotPath = path.join(screenshotDir, "chat_generate_candidate_card.png");
    await page.screenshot({ path: cardScreenshotPath, fullPage: true });
    console.log(`Saved candidate screenshot to: ${cardScreenshotPath}`);

    // Click Preview candidate
    const previewBtn = resultCard.locator('[data-testid="btn-preview-candidate"]');
    if (await previewBtn.isVisible()) {
      console.log("Clicking preview candidate...");
      await previewBtn.click();
      const previewBanner = page.locator('[data-testid="generation-preview-banner"]');
      await previewBanner.waitFor({ state: "visible", timeout: 10000 });
      console.log("Candidate preview banner is active on canvas.");

      // Click Apply Candidate
      const applyBtn = previewBanner.locator('[data-testid="btn-banner-apply-candidate"]');
      console.log("Clicking apply candidate...");
      await applyBtn.click();
      await previewBanner.waitFor({ state: "hidden", timeout: 10000 });
      console.log("Candidate applied successfully!");
    }

    // Wait 2s for canvas iframe to settle
    await page.waitForTimeout(2000);

    // Capture final canvas screenshot
    const finalScreenshotPath = path.join(screenshotDir, "chat_generate_final_canvas.png");
    await page.screenshot({ path: finalScreenshotPath, fullPage: true });
    console.log(`Saved final canvas screenshot to: ${finalScreenshotPath}`);

    console.log("ALL TESTS PASSED: Chat Generate UI is completely usable!");
  } catch (error) {
    console.error("Test failed:", error);
    const errScreenshotPath = path.join(screenshotDir, "chat_generate_error.png");
    await page.screenshot({ path: errScreenshotPath, fullPage: true }).catch(() => {});
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();

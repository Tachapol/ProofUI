import { test, expect } from "@playwright/test";

test.describe("Welcome Landing Page & View Navigation", () => {
  test("proves landing page presentation and smooth switching to canvas editor and back", async ({
    page,
    context,
  }) => {
    // Clear cookies to test as a normal first-time visitor
    await context.clearCookies();

    // Navigate to root
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();

    // 1. Verify Welcome Landing Page elements
    const heroTitle = page.getByRole("heading", {
      name: /Design, Validate, and Optimize Websites/i,
    });
    await expect(heroTitle).toBeVisible();

    const topicBadge = page.getByText(/Evidence-Based UX\/UI Optimization/i);
    await expect(topicBadge).toBeVisible();

    const advisorBadge = page.getByText(/Dr\. Santawat Thanyadit/i);
    await expect(advisorBadge).toBeVisible();

    const launchEditorBtn = page.getByRole("button", {
      name: /Launch Canvas Editor/i,
    }).first();
    await expect(launchEditorBtn).toBeVisible();

    // 2. Launch Canvas Editor
    await launchEditorBtn.click();

    // 3. Verify Canvas Editor is rendered
    await page.waitForSelector('[data-layer-id="body-root"]', { timeout: 10000 });
    const editorCanvas = page.locator('[data-layer-id="body-root"]');
    await expect(editorCanvas).toBeVisible();

    // 4. Click brand logo to return to Welcome Page
    const brandLogoBtn = page.getByTitle(/Return to Welcome Landing Page/i);
    await expect(brandLogoBtn).toBeVisible();
    await brandLogoBtn.click();

    // 5. Verify returned to Welcome Page
    await expect(heroTitle).toBeVisible();
  });
});

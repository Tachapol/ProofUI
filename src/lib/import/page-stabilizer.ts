import { Page } from "playwright";

export interface StabilizationOptions {
  maxScrollHeight?: number; // default 6000
  scrollStep?: number; // default 600
  fontsTimeoutMs?: number; // default 2500
}

export async function stabilizePage(
  page: Page,
  options: StabilizationOptions = {}
): Promise<void> {
  const maxScrollHeight = options.maxScrollHeight ?? 6000;
  const scrollStep = options.scrollStep ?? 600;

  // 1. Wait for document.fonts.ready with timeout
  try {
    await page.evaluate(async (timeoutMs) => {
      if (document.fonts && document.fonts.ready) {
        await Promise.race([
          document.fonts.ready,
          new Promise((resolve) => setTimeout(resolve, timeoutMs)),
        ]);
      }
    }, options.fontsTimeoutMs ?? 2500);
  } catch {
    // Non-fatal if fonts timeout
  }

  // 2. Disable smooth scrolling
  await page.evaluate(() => {
    const style = document.createElement("style");
    style.id = "proofui-stabilize-scroll";
    style.textContent = `
      html, body {
        scroll-behavior: auto !important;
      }
    `;
    document.head.appendChild(style);
  });

  // 3. Scroll through page in bounded increments to trigger lazy content
  try {
    await page.evaluate(
      async ({ step, maxLimit }) => {
        const totalHeight = Math.min(
          document.documentElement.scrollHeight || document.body.scrollHeight,
          maxLimit
        );
        let current = 0;
        while (current < totalHeight) {
          window.scrollBy(0, step);
          current += step;
          await new Promise((r) => setTimeout(r, 80));
        }
        // Scroll back to top
        window.scrollTo(0, 0);
        await new Promise((r) => setTimeout(r, 150));
      },
      { step: scrollStep, maxLimit: maxScrollHeight }
    );
  } catch {
    // Non-fatal scroll error
  }

  // 4. Freeze animations and transitions before capturing screenshot
  await page.evaluate(() => {
    const style = document.createElement("style");
    style.id = "proofui-freeze-animations";
    style.textContent = `
      *, *::before, *::after {
        animation-play-state: paused !important;
        transition: none !important;
      }
    `;
    document.head.appendChild(style);
  });
}

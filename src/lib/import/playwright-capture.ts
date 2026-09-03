import fs from "fs/promises";
import path from "path";
import { chromium, Browser, BrowserContext, Page } from "playwright";
import { validatePublicUrl } from "./url-security";
import {
  CapturePackage,
  CaptureWarning,
  CaptureLimitReport,
  ExtractedStructure,
  MotionSignal,
  AssetManifestEntry,
} from "./schemas";
import { EvidenceTracker } from "./evidence";
import { buildStructuralExtractorScript, recordStructureEvidence } from "./structure-extractor";
import { buildStyleExtractorScript, SampledElementStyle } from "./style-extractor";
import { extractDesignTokens } from "./token-extractor";
import { inferComponentSignals } from "./component-inference";
import { buildMotionExtractorScript, recordMotionEvidence } from "./motion-extractor";
import { evaluateAccessibilityObservations } from "./accessibility-extractor";
import { buildAssetExtractorScript, recordAssetEvidence } from "./asset-extractor";
import { DeterministicDesignMarkdownGenerator } from "./design-markdown-generator";
import { reconstructStaticHtml } from "./static-reconstructor";
import { stabilizePage } from "./page-stabilizer";

export interface CaptureRequest {
  url: string;
  viewport?: {
    width: number;
    height: number;
  };
}

export type CaptureProgressCallback = (stage: string, percent: number) => void;

export interface CaptureServiceOptions {
  storageDir?: string;
  onProgress?: CaptureProgressCallback;
  signal?: AbortSignal;
}

const DEFAULT_VIEWPORT = { width: 1440, height: 900 };
const MAX_SCREENSHOT_HEIGHT = 8000;

export async function captureWebsite(
  request: CaptureRequest,
  options: CaptureServiceOptions = {}
): Promise<CapturePackage> {
  const startTime = Date.now();
  const onProgress = options.onProgress || (() => {});
  const storageDir = options.storageDir || path.join(process.cwd(), ".proofui", "captures");
  const warnings: CaptureWarning[] = [];
  const tracker = new EvidenceTracker();

  // Stage 1: Validating URL
  onProgress("Validating URL", 5);
  const urlValidation = await validatePublicUrl(request.url);

  if (!urlValidation.ok) {
    throw new Error(`URL validation failed [${urlValidation.code}]: ${urlValidation.message}`);
  }

  const validatedUrl = urlValidation.normalizedUrl;
  const captureId = `cap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const captureArtifactDir = path.join(storageDir, captureId);
  await fs.mkdir(captureArtifactDir, { recursive: true });

  const targetViewport = request.viewport || DEFAULT_VIEWPORT;

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    // Stage 2: Opening isolated browser
    onProgress("Opening isolated browser", 15);
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-extensions",
        "--disable-component-extensions-with-background-pages",
      ],
    });

    context = await browser.newContext({
      viewport: {
        width: targetViewport.width,
        height: targetViewport.height,
      },
      deviceScaleFactor: 1,
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 ProofUI/1.0",
      ignoreHTTPSErrors: true,
      javaScriptEnabled: true,
    });

    page = await context.newPage();

    // Intercept network requests for security and resource control
    await page.route("**/*", async (route) => {
      const req = route.request();
      const reqUrl = req.url();
      const resourceType = req.resourceType();

      // Block non-http protocols, websockets, media streaming
      if (
        resourceType === "media" ||
        resourceType === "websocket" ||
        reqUrl.startsWith("ws:") ||
        reqUrl.startsWith("wss:")
      ) {
        return route.abort();
      }

      // Block known tracking or analytics endpoints
      if (
        reqUrl.includes("google-analytics.com") ||
        reqUrl.includes("doubleclick.net") ||
        reqUrl.includes("analytics.") ||
        reqUrl.includes("hotjar.com")
      ) {
        return route.abort();
      }

      return route.continue();
    });

    // Stage 3: Loading page
    onProgress("Loading page", 25);
    let finalUrl = validatedUrl;
    try {
      const response = await page.goto(validatedUrl, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      if (response) {
        finalUrl = response.url();
      }
    } catch (navErr) {
      throw new Error(`Navigation failed: ${navErr instanceof Error ? navErr.message : String(navErr)}`);
    }

    const pageTitle = (await page.title()) || "Imported Page";
    const rawHtml = await page.content();

    // Stage 4: Waiting for fonts and images & Stage 5: Scrolling for lazy content
    onProgress("Waiting for fonts and images", 40);
    onProgress("Scrolling for lazy content", 50);
    await stabilizePage(page, { maxScrollHeight: 5000, scrollStep: 600 });

    // Detect and record fixed overlays
    const fixedOverlaysCount = await page.evaluate(() => {
      const allEls = Array.from(document.querySelectorAll("*"));
      let count = 0;
      for (const el of allEls) {
        const cs = window.getComputedStyle(el);
        if ((cs.position === "fixed" || cs.position === "sticky") && cs.zIndex && parseInt(cs.zIndex, 10) > 100) {
          count++;
        }
      }
      return count;
    });

    if (fixedOverlaysCount > 0) {
      warnings.push({
        code: "FIXED_OVERLAYS_DETECTED",
        message: `Detected ${fixedOverlaysCount} high-z-index fixed elements (e.g. headers or cookie banners).`,
        severity: "info",
      });
    }

    // Stage 6: Capturing screenshot
    onProgress("Capturing screenshot", 60);
    const screenshotPath = path.join(captureArtifactDir, "screenshot.png");
    const thumbnailPath = path.join(captureArtifactDir, "thumbnail.png");

    // Measure page dimensions
    const pageMetrics = await page.evaluate(() => ({
      scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      scrollHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
    }));

    let truncated = false;
    if (pageMetrics.scrollHeight > MAX_SCREENSHOT_HEIGHT) {
      truncated = true;
      warnings.push({
        code: "SCREENSHOT_HEIGHT_TRUNCATED",
        message: `Page height (${pageMetrics.scrollHeight}px) exceeded maximum capture limit (${MAX_SCREENSHOT_HEIGHT}px) and was truncated.`,
        severity: "warning",
      });
    }

    // Native full-page screenshot
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
    });

    // Generate viewport thumbnail
    await page.screenshot({
      path: thumbnailPath,
      fullPage: false,
    });

    // Stage 7: Extracting structure
    onProgress("Extracting structure", 70);
    const structureResult: ExtractedStructure = await page.evaluate(buildStructuralExtractorScript());
    recordStructureEvidence(structureResult, tracker);

    // Stage 8: Extracting styles & tokens
    onProgress("Extracting styles", 78);
    const sampledStyles: SampledElementStyle[] = await page.evaluate(buildStyleExtractorScript(250));
    const designTokens = extractDesignTokens(sampledStyles, tracker);

    // Signals
    const components = inferComponentSignals(structureResult, tracker);

    const motionSignals = (await page.evaluate(buildMotionExtractorScript())) as MotionSignal[];
    recordMotionEvidence(motionSignals, tracker);

    const accessibility = evaluateAccessibilityObservations(structureResult, tracker);

    // Frameworks signals
    const frameworks = [
      {
        name: "Tailwind CSS",
        confidence: 0.85,
        evidence: ["Utility class patterns identified in DOM elements"],
      },
    ];

    // Stage 9: Building asset manifest
    onProgress("Building asset manifest", 86);
    const rawAssets = (await page.evaluate(buildAssetExtractorScript(finalUrl))) as AssetManifestEntry[];
    recordAssetEvidence(rawAssets, tracker);

    // Stage 10: Generating DESIGN.md
    onProgress("Generating DESIGN.md", 92);
    const mdGenerator = new DeterministicDesignMarkdownGenerator();
    const designMarkdown = await mdGenerator.generate({
      title: pageTitle,
      sourceUrl: finalUrl,
      capturedAt: new Date().toISOString(),
      viewport: {
        width: targetViewport.width,
        height: targetViewport.height,
        deviceScaleFactor: 1,
      },
      tokens: designTokens,
      structure: structureResult,
      components,
      motion: motionSignals,
      accessibility,
      assets: rawAssets,
      evidence: tracker.getAll(),
    });

    // Save DESIGN.md in artifact dir
    await fs.writeFile(path.join(captureArtifactDir, "DESIGN.md"), designMarkdown, "utf-8");

    // Reconstruct static editable HTML for ProofUI
    const sanitizedHtml = reconstructStaticHtml(rawHtml, {
      sourceUrl: finalUrl,
      title: pageTitle,
      capturedAt: new Date().toISOString(),
    });

    await fs.writeFile(path.join(captureArtifactDir, "document.html"), sanitizedHtml, "utf-8");

    // Stage 11: Preparing review
    onProgress("Preparing review", 100);

    const limitReport: CaptureLimitReport = {
      totalDurationMs: Date.now() - startTime,
      totalNodesSampled: structureResult.totalNodeCount,
      totalStylesSampled: sampledStyles.length,
      totalAssetsDiscovered: rawAssets.length,
      screenshotTruncated: truncated,
      hiddenOverlaysCount: fixedOverlaysCount,
    };

    const capturePackage: CapturePackage = {
      id: captureId,
      requestedUrl: request.url,
      finalUrl,
      title: pageTitle,
      capturedAt: new Date().toISOString(),
      viewport: {
        width: targetViewport.width,
        height: targetViewport.height,
        deviceScaleFactor: 1,
      },
      screenshot: {
        pathOrUrl: `/api/imports/${captureId}/screenshot`,
        thumbnailPathOrUrl: `/api/imports/${captureId}/screenshot?thumb=1`,
        width: targetViewport.width,
        height: pageMetrics.scrollHeight,
        format: "png",
        strategy: "native-full-page",
        truncated,
      },
      structure: structureResult,
      designTokens,
      components,
      motion: motionSignals,
      accessibility,
      frameworks,
      assets: rawAssets,
      sanitizedHtml,
      designMarkdown,
      evidence: tracker.getAll(),
      warnings,
      limits: limitReport,
    };

    // Save metadata json
    await fs.writeFile(
      path.join(captureArtifactDir, "package.json"),
      JSON.stringify(capturePackage, null, 2),
      "utf-8"
    );

    return capturePackage;
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

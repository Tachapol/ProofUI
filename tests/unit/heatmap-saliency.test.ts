import { describe, it, expect } from "vitest";
import {
  computeSaliencyMap,
  computeClickDensityMap,
  computeScrollReachMap,
} from "@/lib/heatmap/saliency";
import { MeasuredHeatmapNode } from "@/lib/bridge/types";

describe("Heatmap & Saliency Computation Engine", () => {
  const mockNodes: MeasuredHeatmapNode[] = [
    {
      id: "node-h1",
      tagName: "h1",
      rect: { top: 60, left: 100, width: 600, height: 80, bottom: 140, right: 700 },
      textContent: "Design and Optimize Websites with Measurable Evidence",
      isInteractive: false,
    },
    {
      id: "node-cta-primary",
      tagName: "button",
      rect: { top: 160, left: 100, width: 180, height: 48, bottom: 208, right: 280 },
      textContent: "Get Started Free",
      isInteractive: true,
      role: "button",
    },
    {
      id: "node-cta-secondary",
      tagName: "a",
      rect: { top: 160, left: 300, width: 140, height: 48, bottom: 208, right: 440 },
      textContent: "Documentation",
      isInteractive: true,
      role: "link",
    },
    {
      id: "node-footer-link",
      tagName: "a",
      rect: { top: 1200, left: 200, width: 100, height: 24, bottom: 1224, right: 300 },
      textContent: "Privacy Policy",
      isInteractive: true,
    },
  ];

  it("computes cognitive saliency with F-pattern and visual hierarchy prominence", () => {
    const { hotspots, scanpath } = computeSaliencyMap(mockNodes, 800, 1440);

    expect(hotspots.length).toBe(4);
    const h1Spot = hotspots.find((h) => h.id === "node-h1");
    const footerSpot = hotspots.find((h) => h.id === "node-footer-link");

    expect(h1Spot).toBeDefined();
    expect(footerSpot).toBeDefined();

    // H1 above fold should score higher than footer link below fold
    expect(h1Spot!.score).toBeGreaterThan(footerSpot!.score);

    // Scanpath should prioritize top focal points
    expect(scanpath.length).toBeGreaterThanOrEqual(2);
    expect(scanpath[0].scanpathOrder).toBe(1);
    expect(scanpath[0].id).toBe("node-h1");
  });

  it("computes click density hotspots with percentages and intensity", () => {
    const mockEvidence = {
      projectId: "proj_test",
      pageId: "page_test",
      versionId: "v1",
      totalSessions: 500,
      viewportDistribution: { desktop: 300, tablet: 100, mobile: 100 },
      durationBuckets: { "<15s": 50, "15-30s": 100, "30-60s": 150, "1-3m": 150, ">3m": 50 },
      scrollDepthDistribution: { reached25: 480, reached50: 360, reached75: 240, reached100: 120 },
      ctaClickCounts: { "node-cta-primary": 240, "node-cta-secondary": 30 },
      elementClickCounts: { "node-footer-link": 5 },
      mostClickedElements: [],
      lowInteractionImportantElements: [],
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    };

    const { hotspots, totalClicks } = computeClickDensityMap(mockNodes, mockEvidence);

    expect(totalClicks).toBe(275);
    const primaryCta = hotspots.find((h) => h.id === "node-cta-primary");
    const secondaryCta = hotspots.find((h) => h.id === "node-cta-secondary");

    expect(primaryCta).toBeDefined();
    expect(secondaryCta).toBeDefined();
    expect(primaryCta!.clicks).toBe(240);
    expect(primaryCta!.intensity).toBe(1.0); // Highest clicks
    expect(primaryCta!.percent).toBeGreaterThan(80);
  });

  it("computes scroll reach threshold bands", () => {
    const mockEvidence = {
      projectId: "proj_test",
      pageId: "page_test",
      versionId: "v1",
      totalSessions: 1000,
      viewportDistribution: { desktop: 800, tablet: 100, mobile: 100 },
      durationBuckets: { "<15s": 100, "15-30s": 200, "30-60s": 300, "1-3m": 300, ">3m": 100 },
      scrollDepthDistribution: { reached25: 900, reached50: 700, reached75: 400, reached100: 150 },
      ctaClickCounts: {},
      elementClickCounts: {},
      mostClickedElements: [],
      lowInteractionImportantElements: [],
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    };

    const bands = computeScrollReachMap(1600, mockEvidence);
    expect(bands.length).toBe(4);
    expect(bands[0].visitorPercent).toBe(100);
    expect(bands[1].visitorPercent).toBe(90);
    expect(bands[2].visitorPercent).toBe(70);
    expect(bands[3].visitorPercent).toBe(40);
  });
});

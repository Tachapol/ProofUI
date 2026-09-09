import { MeasuredHeatmapNode } from "@/lib/bridge/types";
import { AggregatedProductionEvidence } from "@/lib/production/schemas";

export interface SaliencyHotspot {
  id: string;
  tagName: string;
  textContent?: string;
  x: number; // center x
  y: number; // center y
  width: number;
  height: number;
  score: number; // 0.0 - 1.0 (saliency intensity)
  scanpathOrder?: number; // 1, 2, 3...
  description: string;
  isInteractive: boolean;
}

export interface ClickHotspot {
  id: string;
  tagName: string;
  textContent?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  clicks: number;
  percent: number; // percentage of total clicks
  intensity: number; // 0.0 - 1.0 normalized
  isCta: boolean;
  isLowInteractionWarning: boolean;
}

export interface ScrollReachBand {
  startPercent: number;
  endPercent: number;
  startY: number;
  endY: number;
  visitorPercent: number;
  label: string;
  color: string;
}

/**
 * Computes cognitive visual saliency hotspots and scanpath order
 * based on F-pattern reading model, element sizing, and visual affordances.
 */
export function computeSaliencyMap(
  nodes: MeasuredHeatmapNode[],
  viewportHeight: number = 800,
  viewportWidth: number = 1440
): { hotspots: SaliencyHotspot[]; scanpath: SaliencyHotspot[] } {
  if (!nodes || nodes.length === 0) {
    return { hotspots: [], scanpath: [] };
  }

  const scoredNodes: SaliencyHotspot[] = nodes.map((node) => {
    const { top, left, width, height } = node.rect;
    const centerX = left + width / 2;
    const centerY = top + height / 2;

    // 1. Tag Baseline Weight
    let tagWeight = 0.35;
    const tag = node.tagName.toLowerCase();
    if (tag === "h1") tagWeight = 0.95;
    else if (tag === "h2") tagWeight = 0.8;
    else if (tag === "h3") tagWeight = 0.65;
    else if (node.isInteractive || tag === "button" || tag === "a") tagWeight = 0.85;
    else if (tag === "img" || tag === "svg" || tag === "video") tagWeight = 0.7;
    else if (tag === "nav" || tag === "header") tagWeight = 0.6;

    // 2. F-Pattern & Above-The-Fold Spatial Weight
    // Web users read in F-shape: top-left gets highest natural fixation
    const verticalProgress = Math.max(0, top) / Math.max(viewportHeight, 600);
    const verticalDecay = Math.exp(-verticalProgress * 1.6); // Decreases down the page

    const horizontalProgress = Math.max(0, left) / Math.max(viewportWidth, 1000);
    const horizontalBias = horizontalProgress < 0.5 ? 1.15 : 0.85; // Left-side bias

    // 3. Size Prominence Factor
    const area = width * height;
    const sizeFactor = Math.min(1.2, Math.max(0.6, Math.sqrt(area) / 160));

    // Calculate composite saliency score
    let score = tagWeight * 0.45 + verticalDecay * 0.35 + (horizontalBias * sizeFactor) * 0.2;
    score = Math.min(1.0, Math.max(0.1, score));

    let desc = `${tag.toUpperCase()} element`;
    if (tag === "h1") desc = "Primary Focal Point (Hero Heading)";
    else if (node.isInteractive) desc = "Action Affordance (CTA/Link)";
    else if (tag.startsWith("h")) desc = "Section Header";

    return {
      id: node.id,
      tagName: node.tagName,
      textContent: node.textContent,
      x: centerX,
      y: centerY,
      width,
      height,
      score: Math.round(score * 100) / 100,
      description: desc,
      isInteractive: node.isInteractive,
    };
  });

  // Filter out microscopic or offscreen elements
  const validHotspots = scoredNodes.filter(
    (h) => h.width >= 12 && h.height >= 10 && h.y >= 0
  );

  // Derive Scanpath: Top 6 distinct visual focal points ordered by cognitive priority
  const sortedByPriority = [...validHotspots].sort((a, b) => {
    // Primary sort by score, secondary by vertical position
    if (Math.abs(b.score - a.score) > 0.15) {
      return b.score - a.score;
    }
    return a.y - b.y;
  });

  const scanpath: SaliencyHotspot[] = sortedByPriority.slice(0, 6).map((node, index) => ({
    ...node,
    scanpathOrder: index + 1,
  }));

  return {
    hotspots: validHotspots,
    scanpath,
  };
}

/**
 * Computes click density hotspots from production evidence or realistic simulation
 */
export function computeClickDensityMap(
  nodes: MeasuredHeatmapNode[],
  evidence: AggregatedProductionEvidence | null | undefined
): { hotspots: ClickHotspot[]; totalClicks: number } {
  if (!nodes || nodes.length === 0) {
    return { hotspots: [], totalClicks: 0 };
  }

  const interactiveNodes = nodes.filter(
    (n) => n.isInteractive || n.tagName === "button" || n.tagName === "a"
  );

  const elementClicks = evidence?.elementClickCounts || {};
  const ctaClicks = evidence?.ctaClickCounts || {};

  let totalRecordedClicks = 0;
  for (const c of Object.values(elementClicks)) totalRecordedClicks += c;
  for (const c of Object.values(ctaClicks)) totalRecordedClicks += c;

  // If no live clicks recorded yet, provide realistic heuristic simulation
  const isSimulated = totalRecordedClicks === 0;

  const hotspots: ClickHotspot[] = (interactiveNodes.length > 0 ? interactiveNodes : nodes).map(
    (node, idx) => {
      const { top, left, width, height } = node.rect;
      const centerX = left + width / 2;
      const centerY = top + height / 2;

      let clickCount = 0;
      if (!isSimulated) {
        clickCount = (elementClicks[node.id] || 0) + (ctaClicks[node.id] || 0);
      } else {
        // Realistic simulation: Primary hero CTAs get high traffic, secondary lower
        const isAboveFold = top < 650;
        const text = (node.textContent || "").toLowerCase();
        const isPrimaryCta =
          text.includes("get started") ||
          text.includes("launch") ||
          text.includes("sign up") ||
          text.includes("start") ||
          text.includes("buy") ||
          idx === 0;

        if (isPrimaryCta && isAboveFold) clickCount = Math.floor(180 + Math.random() * 80);
        else if (isAboveFold) clickCount = Math.floor(45 + Math.random() * 40);
        else clickCount = Math.floor(8 + Math.random() * 20);
      }

      const isCta =
        node.tagName === "button" ||
        (node.textContent || "").length < 30;

      return {
        id: node.id,
        tagName: node.tagName,
        textContent: node.textContent,
        x: centerX,
        y: centerY,
        width,
        height,
        clicks: clickCount,
        percent: 0,
        intensity: 0,
        isCta,
        isLowInteractionWarning: false,
      };
    }
  );

  const totalClicks = hotspots.reduce((sum, h) => sum + h.clicks, 0) || 1;
  const maxClicks = Math.max(...hotspots.map((h) => h.clicks), 1);

  for (const h of hotspots) {
    h.percent = Math.round((h.clicks / totalClicks) * 1000) / 10;
    h.intensity = Math.min(1.0, Math.max(0.05, h.clicks / maxClicks));
    // Flag low interaction on CTAs that receive under 3% of clicks
    if (h.isCta && h.percent < 3.0 && totalClicks > 50) {
      h.isLowInteractionWarning = true;
    }
  }

  // Sort by clicks descending
  hotspots.sort((a, b) => b.clicks - a.clicks);

  return {
    hotspots,
    totalClicks,
  };
}

/**
 * Computes scroll depth reach distribution
 */
export function computeScrollReachMap(
  scrollHeight: number,
  evidence: AggregatedProductionEvidence | null | undefined
): ScrollReachBand[] {
  const totalSessions = evidence?.totalSessions || 100;
  const dist = evidence?.scrollDepthDistribution || {
    reached25: Math.round(totalSessions * 0.98),
    reached50: Math.round(totalSessions * 0.74),
    reached75: Math.round(totalSessions * 0.48),
    reached100: Math.round(totalSessions * 0.22),
  };

  const p25 = totalSessions > 0 ? Math.round((dist.reached25 / totalSessions) * 100) : 98;
  const p50 = totalSessions > 0 ? Math.round((dist.reached50 / totalSessions) * 100) : 74;
  const p75 = totalSessions > 0 ? Math.round((dist.reached75 / totalSessions) * 100) : 48;
  const p100 = totalSessions > 0 ? Math.round((dist.reached100 / totalSessions) * 100) : 22;

  const h = Math.max(scrollHeight, 800);

  return [
    {
      startPercent: 0,
      endPercent: 25,
      startY: 0,
      endY: h * 0.25,
      visitorPercent: 100,
      label: "Hero & Above-the-fold (100% Seen)",
      color: "rgba(34, 197, 94, 0.25)", // Emerald
    },
    {
      startPercent: 25,
      endPercent: 50,
      startY: h * 0.25,
      endY: h * 0.5,
      visitorPercent: p25,
      label: `Features & Value Proposition (${p25}% Reach)`,
      color: "rgba(234, 179, 8, 0.25)", // Amber
    },
    {
      startPercent: 50,
      endPercent: 75,
      startY: h * 0.5,
      endY: h * 0.75,
      visitorPercent: p50,
      label: `Social Proof & Testimonials (${p50}% Reach)`,
      color: "rgba(249, 115, 22, 0.25)", // Orange
    },
    {
      startPercent: 75,
      endPercent: 100,
      startY: h * 0.75,
      endY: h,
      visitorPercent: p75,
      label: `Pricing & Footer (${p75}% Reach - ${p100}% Finished)`,
      color: "rgba(239, 68, 68, 0.25)", // Red
    },
  ];
}

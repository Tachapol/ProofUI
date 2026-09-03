import { SampledElementStyle } from "./style-extractor";
import { ExtractedDesignTokens, TokenCandidate } from "./schemas";
import { EvidenceTracker } from "./evidence";

function normalizeColor(colorStr: string): string {
  const c = colorStr.trim().toLowerCase();
  // Filter out transparent
  if (c === "transparent" || c === "rgba(0, 0, 0, 0)") return "";
  return c;
}

function countFrequencies<T extends string>(items: Array<{ value: T; id?: string }>): TokenCandidate[] {
  const map = new Map<T, { count: number; sampleIds: string[] }>();

  for (const item of items) {
    if (!item.value || !item.value.trim()) continue;
    const key = item.value.trim() as T;
    const existing = map.get(key);
    if (existing) {
      existing.count++;
      if (item.id && existing.sampleIds.length < 5 && !existing.sampleIds.includes(item.id)) {
        existing.sampleIds.push(item.id);
      }
    } else {
      map.set(key, { count: 1, sampleIds: item.id ? [item.id] : [] });
    }
  }

  return Array.from(map.entries())
    .map(([value, { count, sampleIds }]) => ({
      value,
      frequency: count,
      sampleNodeIds: sampleIds,
      confidence: Math.min(0.95, 0.5 + count * 0.05),
      evidence: [`Observed ${count} times in computed element styles`],
    }))
    .sort((a, b) => b.frequency - a.frequency);
}

export function extractDesignTokens(
  styles: SampledElementStyle[],
  tracker: EvidenceTracker
): ExtractedDesignTokens {
  // 1. Color candidates
  const textColors: Array<{ value: string; id?: string }> = [];
  const bgColors: Array<{ value: string; id?: string }> = [];
  const borderColors: Array<{ value: string; id?: string }> = [];
  const buttonBgColors: Array<{ value: string; id?: string }> = [];

  for (const s of styles) {
    const c = normalizeColor(s.color);
    if (c) textColors.push({ value: c, id: s.captureId });

    const bg = normalizeColor(s.backgroundColor);
    if (bg) {
      bgColors.push({ value: bg, id: s.captureId });
      if (s.tagName === "button" || s.role === "button") {
        buttonBgColors.push({ value: bg, id: s.captureId });
      }
    }

    const bCol = normalizeColor(s.borderColor);
    if (bCol) borderColors.push({ value: bCol, id: s.captureId });
  }

  const allBgTokens = countFrequencies(bgColors);
  const allTextTokens = countFrequencies(textColors);
  const allBorderTokens = countFrequencies(borderColors);
  const buttonBgTokens = countFrequencies(buttonBgColors);

  // Derive semantic colors without falsely labeling most common background as primary
  // Primary color: button background or strong recurring interactive background
  let primaryCandidate = buttonBgTokens.find(
    (b) => b.value !== "rgb(255, 255, 255)" && b.value !== "rgb(0, 0, 0)"
  );
  if (!primaryCandidate && buttonBgTokens.length > 0) {
    primaryCandidate = buttonBgTokens[0];
  }

  // Background color: body or top element background
  const bodyStyle = styles.find((s) => s.tagName === "body");
  const backgroundCandidate = bodyStyle && normalizeColor(bodyStyle.backgroundColor)
    ? {
        value: normalizeColor(bodyStyle.backgroundColor),
        frequency: 1,
        sampleNodeIds: ["body"],
        confidence: 0.95,
        evidence: ["Observed directly on <body> element computed style"],
      }
    : allBgTokens[0];

  // Surface color: second most common background or card background
  const surfaceCandidate = allBgTokens.find(
    (bg) => bg.value !== backgroundCandidate?.value && bg.value !== primaryCandidate?.value
  );

  // Text colors
  const textPrimaryCandidate = allTextTokens[0];
  const textMutedCandidate = allTextTokens[1];

  // 2. Typography
  const fontFamilies = countFrequencies(
    styles.map((s) => ({ value: s.fontFamily.split(",")[0].replace(/['"]/g, "").trim(), id: s.captureId }))
  );

  // Parse font sizes in px, sort numerically
  const fontSizeCandidates = countFrequencies(
    styles.map((s) => ({ value: s.fontSize, id: s.captureId }))
  ).sort((a, b) => {
    const numA = parseFloat(a.value) || 0;
    const numB = parseFloat(b.value) || 0;
    return numA - numB;
  });

  const fontWeights = countFrequencies(
    styles.map((s) => ({ value: s.fontWeight, id: s.captureId }))
  ).sort((a, b) => (parseInt(a.value, 10) || 0) - (parseInt(b.value, 10) || 0));

  const lineHeights = countFrequencies(
    styles.map((s) => ({ value: s.lineHeight, id: s.captureId }))
  );

  // 3. Spacing & Container
  const paddings = countFrequencies(
    styles
      .filter((s) => s.padding && s.padding !== "0px")
      .map((s) => ({ value: s.padding.split(" ")[0], id: s.captureId }))
  );

  const gaps = countFrequencies(
    styles
      .filter((s) => s.gap && s.gap !== "normal" && s.gap !== "0px")
      .map((s) => ({ value: s.gap, id: s.captureId }))
  );

  // 4. Radii & Shadows
  const radii = countFrequencies(
    styles
      .filter((s) => s.borderRadius && s.borderRadius !== "0px")
      .map((s) => ({ value: s.borderRadius.split(" ")[0], id: s.captureId }))
  );

  const shadows = countFrequencies(
    styles
      .filter((s) => s.boxShadow && s.boxShadow !== "none")
      .map((s) => ({ value: s.boxShadow, id: s.captureId }))
  );

  // Record token evidence
  if (primaryCandidate) {
    tracker.add({
      category: "style",
      source: "computed-style",
      property: "primary-color",
      rawValue: primaryCandidate.value,
      description: `Inferred primary interactive color from button and call-to-action computed styles: ${primaryCandidate.value}`,
      confidence: 0.85,
    });
  }

  if (backgroundCandidate) {
    tracker.add({
      category: "style",
      source: "computed-style",
      property: "background-color",
      rawValue: backgroundCandidate.value,
      description: `Observed main page background color: ${backgroundCandidate.value}`,
      confidence: 0.95,
    });
  }

  return {
    colors: {
      primary: primaryCandidate,
      secondary: surfaceCandidate,
      accent: allBgTokens[2],
      background: backgroundCandidate,
      surface: surfaceCandidate,
      textPrimary: textPrimaryCandidate,
      textMuted: textMutedCandidate,
      border: allBorderTokens[0],
      allSampled: allBgTokens.concat(allTextTokens).slice(0, 12),
    },
    typography: {
      fontFamilies: fontFamilies.slice(0, 4),
      fontSizeScale: fontSizeCandidates.slice(0, 8),
      fontWeights: fontWeights.slice(0, 5),
      lineHeights: lineHeights.slice(0, 5),
    },
    spacing: {
      paddingScale: paddings.slice(0, 6),
      gapScale: gaps.slice(0, 6),
      containerWidths: [
        {
          value: "1440px",
          frequency: 1,
          sampleNodeIds: [],
          confidence: 0.9,
          evidence: ["Standard desktop capture viewport bound"],
        },
      ],
    },
    radii: radii.slice(0, 5),
    shadows: shadows.slice(0, 4),
  };
}

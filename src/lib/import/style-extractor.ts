export interface SampledElementStyle {
  captureId?: string;
  tagName: string;
  role?: string;
  className?: string;
  color: string;
  backgroundColor: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing: string;
  display: string;
  position: string;
  padding: string;
  margin: string;
  gap: string;
  borderRadius: string;
  borderWidth: string;
  borderColor: string;
  boxShadow: string;
  opacity: string;
}

export function buildStyleExtractorScript(maxSamples: number = 300) {
  return `(() => {
    const samples = [];
    const maxSamples = ${maxSamples};

    // Prioritize key structural and interactive elements
    const selectors = [
      "body", "header", "nav", "main", "footer", "section",
      "h1", "h2", "h3", "h4", "p", "a", "button", "input",
      "[role='button']", "[role='navigation']", ".card", "[class*='card']"
    ];

    const visited = new Set();

    for (const selector of selectors) {
      if (samples.length >= maxSamples) break;
      const elements = Array.from(document.querySelectorAll(selector));
      for (const el of elements) {
        if (samples.length >= maxSamples) break;
        if (visited.has(el)) continue;
        visited.add(el);

        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;

        const cs = window.getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") continue;

        samples.push({
          tagName: el.tagName.toLowerCase(),
          role: el.getAttribute("role") || undefined,
          className: (el.className && typeof el.className === "string") ? el.className.slice(0, 100) : undefined,
          color: cs.color,
          backgroundColor: cs.backgroundColor,
          fontFamily: cs.fontFamily,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          lineHeight: cs.lineHeight,
          letterSpacing: cs.letterSpacing,
          display: cs.display,
          position: cs.position,
          padding: cs.padding,
          margin: cs.margin,
          gap: cs.gap,
          borderRadius: cs.borderRadius,
          borderWidth: cs.borderWidth,
          borderColor: cs.borderColor,
          boxShadow: cs.boxShadow,
          opacity: cs.opacity,
        });
      }
    }

    return samples;
  })()`;
}

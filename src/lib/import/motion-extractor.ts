import { MotionSignal } from "./schemas";
import { EvidenceTracker } from "./evidence";

export function buildMotionExtractorScript() {
  return `(() => {
    const signals = [];
    const elements = Array.from(document.querySelectorAll("*")).slice(0, 300);

    // Check prefers-reduced-motion media query support
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery) {
      signals.push({
        kind: "reduced-motion-support",
        value: "prefers-reduced-motion media query supported",
        confidence: 0.95,
        evidence: ["Media query (prefers-reduced-motion: reduce) evaluated in browser"],
      });
    }

    for (const el of elements) {
      const cs = window.getComputedStyle(el);

      // Sticky / Fixed
      if (cs.position === "fixed" || cs.position === "sticky") {
        signals.push({
          kind: cs.position,
          value: cs.position,
          confidence: 0.98,
          evidence: ["Computed position: " + cs.position + " on <" + el.tagName.toLowerCase() + ">"],
        });
      }

      // CSS Animations
      if (cs.animationName && cs.animationName !== "none") {
        signals.push({
          kind: "css-animation",
          value: cs.animationName + " (" + cs.animationDuration + ")",
          confidence: 0.92,
          evidence: ["Keyframe animation: " + cs.animationName + " with duration " + cs.animationDuration],
        });
      }

      // Transitions
      if (cs.transitionProperty && cs.transitionProperty !== "none" && cs.transitionProperty !== "all 0s ease 0s") {
        if (parseFloat(cs.transitionDuration) > 0) {
          signals.push({
            kind: "css-transition",
            value: cs.transitionProperty + " " + cs.transitionDuration,
            confidence: 0.88,
            evidence: ["CSS transition: " + cs.transitionProperty + " over " + cs.transitionDuration],
          });
        }
      }
    }

    // Deduplicate signals
    const uniqueMap = new Map();
    for (const s of signals) {
      const key = s.kind + ":" + s.value;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, s);
      }
    }

    return Array.from(uniqueMap.values()).slice(0, 8);
  })()`;
}

export function recordMotionEvidence(signals: MotionSignal[], tracker: EvidenceTracker) {
  for (const s of signals) {
    tracker.add({
      category: "motion",
      source: "computed-style",
      description: `Observed motion signal: ${s.kind} (${s.value || ""})`,
      confidence: s.confidence,
    });
  }
}

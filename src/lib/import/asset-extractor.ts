import { AssetManifestEntry } from "./schemas";
import { EvidenceTracker } from "./evidence";

export function buildAssetExtractorScript(baseUrl: string) {
  return `(() => {
    const assets = [];
    const seen = new Set();
    const baseUrl = ${JSON.stringify(baseUrl)};

    function resolveUrl(rawUrl) {
      if (!rawUrl || typeof rawUrl !== "string") return null;
      const trimmed = rawUrl.trim();
      if (!trimmed || trimmed.startsWith("javascript:") || trimmed.startsWith("data:text/html")) {
        return null;
      }
      try {
        return new URL(trimmed, baseUrl).toString();
      } catch {
        return null;
      }
    }

    function addAsset(rawUrl, type, sourceContext, extra = {}) {
      const resolved = resolveUrl(rawUrl);
      if (!resolved || seen.has(resolved)) return;
      seen.add(resolved);

      const isSvg = resolved.toLowerCase().includes(".svg") || rawUrl.toLowerCase().includes("image/svg+xml");

      assets.push({
        id: "asset_" + (assets.length + 1),
        originalUrl: rawUrl.slice(0, 300),
        normalizedUrl: resolved,
        type: isSvg ? "icon" : type,
        sourceContext,
        alt: extra.alt ? extra.alt.slice(0, 100) : undefined,
        nearbyText: extra.nearbyText ? extra.nearbyText.slice(0, 100) : undefined,
        width: extra.width,
        height: extra.height,
        downloadable: !isSvg && (resolved.startsWith("http://") || resolved.startsWith("https://") || resolved.startsWith("data:image/")),
        warning: isSvg ? "SVG treated as active vector content; requires sanitization." : undefined,
      });
    }

    // 1. Image elements <img>
    for (const img of Array.from(document.querySelectorAll("img"))) {
      const src = img.getAttribute("src");
      if (src) {
        addAsset(src, "image", "img[src]", {
          alt: img.getAttribute("alt") || undefined,
          width: img.naturalWidth || img.width || undefined,
          height: img.naturalHeight || img.height || undefined,
        });
      }
    }

    // 2. Picture / Source srcset
    for (const srcEl of Array.from(document.querySelectorAll("source[srcset]"))) {
      const srcset = srcEl.getAttribute("srcset");
      if (srcset) {
        const firstSrc = srcset.split(",")[0].trim().split(" ")[0];
        if (firstSrc) addAsset(firstSrc, "image", "srcset");
      }
    }

    // 3. Open Graph and Twitter images
    const ogImg = document.querySelector('meta[property="og:image"]');
    if (ogImg && ogImg.getAttribute("content")) {
      addAsset(ogImg.getAttribute("content"), "image", "og:image");
    }

    const twImg = document.querySelector('meta[name="twitter:image"]');
    if (twImg && twImg.getAttribute("content")) {
      addAsset(twImg.getAttribute("content"), "image", "twitter:image");
    }

    // 4. Favicon / Apple touch icon
    const icon = document.querySelector('link[rel*="icon"]');
    if (icon && icon.getAttribute("href")) {
      addAsset(icon.getAttribute("href"), "icon", "favicon");
    }

    // 5. CSS Background Images
    const allEls = Array.from(document.querySelectorAll("*")).slice(0, 200);
    for (const el of allEls) {
      const bg = window.getComputedStyle(el).backgroundImage;
      if (bg && bg.startsWith("url(") && bg !== "none") {
        const match = /url\\((?:['"]?)(.*?)(?:['"]?)\\)/i.exec(bg);
        if (match && match[1]) {
          addAsset(match[1], "background", "css-url");
        }
      }
    }

    return assets.slice(0, 50);
  })()`;
}

export function recordAssetEvidence(assets: AssetManifestEntry[], tracker: EvidenceTracker) {
  tracker.add({
    category: "asset",
    source: "metadata",
    description: `Discovered and deduplicated ${assets.length} public asset references (images, icons, backgrounds).`,
    confidence: 0.95,
  });
}

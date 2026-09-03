import { describe, it, expect } from "vitest";
import {
  validateAttachmentFile,
  sanitizeAttachmentName,
  MAX_ATTACHMENT_SIZE_BYTES,
} from "../../src/lib/chat/attachment-validation";

describe("Chat Attachment Security & Validation", () => {
  it("accepts valid image formats (PNG, JPEG, WebP)", () => {
    const pngRes = validateAttachmentFile({
      name: "screen.png",
      type: "image/png",
      size: 1024 * 500, // 500 KB
    });
    expect(pngRes.valid).toBe(true);
    expect(pngRes.kind).toBe("screenshot");

    const webpRes = validateAttachmentFile({
      name: "banner.webp",
      type: "image/webp",
      size: 1024 * 800,
    });
    expect(webpRes.valid).toBe(true);
    expect(webpRes.kind).toBe("screenshot");
  });

  it("accepts valid document formats (Markdown, HTML)", () => {
    const mdRes = validateAttachmentFile({
      name: "DESIGN.md",
      type: "text/markdown",
      size: 1024 * 10,
    });
    expect(mdRes.valid).toBe(true);
    expect(mdRes.kind).toBe("design-markdown");

    const htmlRes = validateAttachmentFile({
      name: "template.html",
      type: "text/html",
      size: 1024 * 25,
    });
    expect(htmlRes.valid).toBe(true);
    expect(htmlRes.kind).toBe("html-reference");
  });

  it("rejects executable and script files (.exe, .sh, .js)", () => {
    const exeRes = validateAttachmentFile({
      name: "installer.exe",
      type: "application/octet-stream",
      size: 1024 * 50,
    });
    expect(exeRes.valid).toBe(false);
    expect(exeRes.error).toContain("forbidden");

    const jsRes = validateAttachmentFile({
      name: "malicious.js",
      type: "text/javascript",
      size: 1024,
    });
    expect(jsRes.valid).toBe(false);
    expect(jsRes.error).toContain("forbidden");
  });

  it("strictly rejects SVG files for now", () => {
    const svgRes = validateAttachmentFile({
      name: "icon.svg",
      type: "image/svg+xml",
      size: 1024 * 5,
    });
    expect(svgRes.valid).toBe(false);
    expect(svgRes.error).toContain("forbidden");
  });

  it("enforces per-file size limit (max 5MB)", () => {
    const oversizedRes = validateAttachmentFile({
      name: "giant_screenshot.png",
      type: "image/png",
      size: MAX_ATTACHMENT_SIZE_BYTES + 1024,
    });
    expect(oversizedRes.valid).toBe(false);
    expect(oversizedRes.error).toContain("exceeds the maximum allowed limit");
  });

  it("sanitizes path traversal attempts in filename", () => {
    const sanitized = sanitizeAttachmentName("../../../etc/passwd");
    expect(sanitized).toBe("passwd");
    expect(sanitized).not.toContain("..");
    expect(sanitized).not.toContain("/");

    const windowsPath = sanitizeAttachmentName("C:\\Windows\\System32\\cmd.exe");
    expect(windowsPath).toBe("cmd.exe");
  });
});

import { ChatAttachment } from "./schemas";

export const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB per file
export const MAX_TOTAL_ATTACHMENTS_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB total

export const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/markdown",
  "text/html",
  "text/plain",
]);

export const FORBIDDEN_EXTENSIONS = new Set([
  ".exe",
  ".sh",
  ".bat",
  ".cmd",
  ".js",
  ".mjs",
  ".cjs",
  ".py",
  ".bin",
  ".app",
  ".svg",
  ".msi",
  ".com",
  ".scr",
  ".vbs",
]);

export function sanitizeAttachmentName(rawName: string): string {
  if (!rawName) return "unnamed_attachment";
  // Remove path traversals and directory separators
  const baseName = rawName.split(/[/\\]/).pop() || "attachment";
  // Remove non-printable or dangerous characters
  return baseName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
}

export function validateAttachmentFile(file: {
  name: string;
  type: string;
  size: number;
}): { valid: boolean; error?: string; kind?: ChatAttachment["kind"]; cleanName: string } {
  const cleanName = sanitizeAttachmentName(file.name);
  const ext = "." + (cleanName.split(".").pop() || "").toLowerCase();

  // 1. Extension blocklist
  if (FORBIDDEN_EXTENSIONS.has(ext) || ext === ".svg") {
    return {
      valid: false,
      error: `Files with extension "${ext}" are forbidden for security.`,
      cleanName,
    };
  }

  // 2. MIME type check
  const mime = (file.type || "").toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mime)) {
    return {
      valid: false,
      error: `File type "${mime || "unknown"}" is not supported. Allowed: PNG, JPEG, WebP, Markdown, HTML.`,
      cleanName,
    };
  }

  // 3. Size limit check
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size (${sizeMb}MB) exceeds the maximum allowed limit of 5MB.`,
      cleanName,
    };
  }

  // 4. Derive kind
  let kind: ChatAttachment["kind"] = "html-reference";
  if (mime.startsWith("image/")) {
    kind = "screenshot";
  } else if (mime === "text/markdown" || ext === ".md") {
    kind = "design-markdown";
  } else if (mime === "text/html" || ext === ".html") {
    kind = "html-reference";
  }

  return {
    valid: true,
    kind,
    cleanName,
  };
}

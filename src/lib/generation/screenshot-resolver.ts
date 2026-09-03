import { promises as fs } from "fs";
import * as path from "path";

export interface ResolvedScreenshot {
  dataUrl: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
}

export class ScreenshotResolutionError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "ATTACHMENT_NOT_FOUND"
      | "ATTACHMENT_TOO_LARGE"
      | "ATTACHMENT_INVALID_DIMENSIONS"
      | "UNSUPPORTED_MIME"
  ) {
    super(message);
    this.name = "ScreenshotResolutionError";
  }
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 4096;

function readUInt24LE(bytes: Buffer, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function inspectImage(bytes: Buffer): {
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  width: number;
  height: number;
} {
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(pngSignature)) {
    return {
      mimeType: "image/png",
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
    };
  }

  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    const startOfFrameMarkers = new Set([
      0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
      0xce, 0xcf,
    ]);
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      if (marker === 0xd8 || marker === 0xd9) {
        offset += 2;
        continue;
      }
      const segmentLength = bytes.readUInt16BE(offset + 2);
      if (segmentLength < 2 || offset + segmentLength + 2 > bytes.length) break;
      if (startOfFrameMarkers.has(marker)) {
        return {
          mimeType: "image/jpeg",
          height: bytes.readUInt16BE(offset + 5),
          width: bytes.readUInt16BE(offset + 7),
        };
      }
      offset += segmentLength + 2;
    }
  }

  if (
    bytes.length >= 30 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    const chunk = bytes.toString("ascii", 12, 16);
    if (chunk === "VP8X") {
      return {
        mimeType: "image/webp",
        width: readUInt24LE(bytes, 24) + 1,
        height: readUInt24LE(bytes, 27) + 1,
      };
    }
    if (chunk === "VP8 ") {
      return {
        mimeType: "image/webp",
        width: bytes.readUInt16LE(26) & 0x3fff,
        height: bytes.readUInt16LE(28) & 0x3fff,
      };
    }
    if (chunk === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
      const bits = bytes.readUInt32LE(21);
      return {
        mimeType: "image/webp",
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
  }

  throw new ScreenshotResolutionError(
    "Screenshot is not a valid PNG, JPEG, or WebP image.",
    "UNSUPPORTED_MIME"
  );
}

function assertAllowedCapturePath(candidatePath: string, captureRoot: string): void {
  const relative = path.relative(captureRoot, candidatePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new ScreenshotResolutionError(
      "Screenshot reference is not an authorized capture artifact.",
      "ATTACHMENT_NOT_FOUND"
    );
  }
}

/** Resolve an authorized server-side capture artifact without exposing its path. */
export async function resolveScreenshotReference(
  screenshotReference: string
): Promise<ResolvedScreenshot> {
  if (screenshotReference.startsWith("data:")) {
    throw new ScreenshotResolutionError(
      "Inline screenshot data is not an authorized capture artifact.",
      "ATTACHMENT_NOT_FOUND"
    );
  }

  const captureRoot = path.resolve(process.cwd(), ".proofui", "captures");
  const requestedPath = path.resolve(screenshotReference);
  assertAllowedCapturePath(requestedPath, captureRoot);

  let realPath: string;
  try {
    realPath = await fs.realpath(requestedPath);
  } catch {
    throw new ScreenshotResolutionError("Screenshot file not found.", "ATTACHMENT_NOT_FOUND");
  }
  assertAllowedCapturePath(realPath, captureRoot);

  const stat = await fs.stat(realPath);
  if (!stat.isFile()) {
    throw new ScreenshotResolutionError("Screenshot file not found.", "ATTACHMENT_NOT_FOUND");
  }
  if (stat.size > MAX_FILE_SIZE_BYTES) {
    throw new ScreenshotResolutionError(
      "Screenshot exceeds the 10 MB size limit.",
      "ATTACHMENT_TOO_LARGE"
    );
  }

  const bytes = await fs.readFile(realPath);
  const image = inspectImage(bytes);
  if (
    image.width < 1 ||
    image.height < 1 ||
    image.width > MAX_IMAGE_DIMENSION ||
    image.height > MAX_IMAGE_DIMENSION
  ) {
    throw new ScreenshotResolutionError(
      "Screenshot dimensions must be between 1 and 4096 pixels per side.",
      "ATTACHMENT_INVALID_DIMENSIONS"
    );
  }

  return {
    dataUrl: `data:${image.mimeType};base64,${bytes.toString("base64")}`,
    mimeType: image.mimeType,
    width: image.width,
    height: image.height,
    sizeBytes: stat.size,
  };
}

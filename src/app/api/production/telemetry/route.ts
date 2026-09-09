import { NextRequest, NextResponse } from "next/server";
import {
  ProductionTelemetryPayloadSchema,
  MAX_PAYLOAD_SIZE_BYTES,
  FORBIDDEN_PAYLOAD_KEYS,
} from "@/lib/production/schemas";
import { productionStore } from "@/lib/production/store";
import { productionTelemetryLimiter } from "@/lib/production/rate-limiter";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(req: NextRequest) {
  try {
    // 1. Size Limit Check (Content-Length and text size)
    const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
    if (contentLength > MAX_PAYLOAD_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Payload exceeds size limit (32KB)." },
        { status: 413 }
      );
    }

    const rawText = await req.text();
    if (new TextEncoder().encode(rawText).length > MAX_PAYLOAD_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Payload exceeds size limit (32KB)." },
        { status: 413 }
      );
    }

    // 2. Rate Limiting Check (per client IP / forwarded IP)
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";
    const rateCheck = productionTelemetryLimiter.check(clientIp);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429 }
      );
    }

    // 3. Parse JSON safely
    let rawBody: unknown;
    try {
      rawBody = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload." },
        { status: 400 }
      );
    }

    // 4. Check for forbidden privacy-violating keys in raw object
    if (typeof rawBody === "object" && rawBody !== null) {
      const keys = Object.keys(rawBody as Record<string, unknown>);
      for (const key of keys) {
        if (FORBIDDEN_PAYLOAD_KEYS.has(key)) {
          return NextResponse.json(
            { error: `Forbidden field detected: "${key}". Telemetry strictly rejects form data, credentials, and PII.` },
            { status: 400 }
          );
        }
      }
    }

    // 5. Zod Validation (strict schema ensures unexpected properties are rejected)
    const parseResult = ProductionTelemetryPayloadSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid telemetry payload schema.",
          details: parseResult.error.format(),
        },
        { status: 400 }
      );
    }

    const payload = parseResult.data;

    // 6. Project/Page/Version existence validation (reject arbitrary/unregistered IDs)
    const isValidTarget = productionStore.hasPublishedVersion(
      payload.projectId,
      payload.pageId,
      payload.versionId
    );
    if (!isValidTarget) {
      return NextResponse.json(
        {
          error: `Unknown or unverified target project/version: ${payload.projectId}/${payload.versionId}`,
        },
        { status: 404 }
      );
    }

    // 7. Aggregate into store (bounded metrics only, never stores client IP or session tokens)
    if (!productionStore.recordTelemetry(payload)) {
      return NextResponse.json({ error: "Experiment assignment does not match the published project/page/version." }, { status: 400 });
    }

    return NextResponse.json({ success: true }, { status: 200, headers: corsHeaders });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Internal telemetry error.";
    return NextResponse.json({ error: errorMsg }, { status: 500, headers: corsHeaders });
  }
}

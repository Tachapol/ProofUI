import { NextRequest, NextResponse } from "next/server";
import { getSampleTailwindDocument } from "@/lib/sample-document";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId") || "default-session";
  const html = getSampleTailwindDocument(sessionId);
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

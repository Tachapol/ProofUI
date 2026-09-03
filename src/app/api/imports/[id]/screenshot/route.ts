import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const isThumb = req.nextUrl.searchParams.get("thumb") === "1";
  const fileName = isThumb ? "thumbnail.png" : "screenshot.png";

  // Prevent path traversal
  const cleanId = id.replace(/[^a-zA-Z0-9_-]/g, "");
  const filePath = path.join(process.cwd(), ".proofui", "captures", cleanId, fileName);

  try {
    const fileBuffer = await fs.readFile(filePath);
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Screenshot not found." }, { status: 404 });
  }
}

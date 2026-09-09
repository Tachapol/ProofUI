import { NextRequest, NextResponse } from "next/server";
import { PromoteWinnerRequestSchema } from "@/lib/experiment/schemas";
import { productionStore } from "@/lib/production/store";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const experiment = productionStore.getExperiment(id);
    if (!experiment) {
      return NextResponse.json(
        { error: `Experiment with id '${id}' not found.` },
        { status: 404 }
      );
    }

    const rawBody = await req.json();
    const parseResult = PromoteWinnerRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Explicit confirmation ('confirmed: true') and target 'versionId' are strictly required to promote a winner.",
          details: parseResult.error.format(),
        },
        { status: 400 }
      );
    }

    const { versionId } = parseResult.data;

    try {
      productionStore.promoteWinner(id, versionId);
    } catch (promoteErr) {
      const msg = promoteErr instanceof Error ? promoteErr.message : "Failed to promote version";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      experimentId: id,
      promotedVersionId: versionId,
      message: `Version '${versionId}' successfully promoted to active published version.`,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Internal error promoting winner.";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

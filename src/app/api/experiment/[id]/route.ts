import { NextRequest, NextResponse } from "next/server";
import { productionStore } from "@/lib/production/store";

export async function GET(
  _req: NextRequest,
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

    const evaluation = productionStore.getExperimentEvaluation(id);

    return NextResponse.json({
      success: true,
      experiment,
      evaluation,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to retrieve experiment details.";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { CreateExperimentRequestSchema } from "@/lib/experiment/schemas";
import { productionStore } from "@/lib/production/store";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parseResult = CreateExperimentRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid create experiment request.",
          details: parseResult.error.format(),
        },
        { status: 400 }
      );
    }

    const payload = parseResult.data;

    // Verify control version is published
    if (!productionStore.hasPublishedVersion(payload.projectId, payload.pageId, payload.controlVersionId)) {
      return NextResponse.json(
        {
          error: `Control version '${payload.controlVersionId}' is not published for project '${payload.projectId}'.`,
        },
        { status: 400 }
      );
    }

    // Verify variant version is published
    if (!productionStore.hasPublishedVersion(payload.projectId, payload.pageId, payload.variantVersionId)) {
      return NextResponse.json(
        {
          error: `Variant version '${payload.variantVersionId}' is not published for project '${payload.projectId}'.`,
        },
        { status: 400 }
      );
    }

    const experiment = productionStore.createExperiment(payload);

    return NextResponse.json(
      {
        success: true,
        experiment,
      },
      { status: 201 }
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to create experiment.";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "Query parameter 'projectId' is required." },
        { status: 400 }
      );
    }

    const experiments = productionStore.getExperimentsForProject(projectId);

    return NextResponse.json({
      success: true,
      experiments,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to retrieve experiments.";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

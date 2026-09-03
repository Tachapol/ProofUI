import { NextRequest, NextResponse } from "next/server";
import { AIEditRequestSchema, AIEditProposalSchema } from "@/lib/ai/schemas";
import { MockAIEditProvider } from "@/lib/ai/mock-provider";

const provider = new MockAIEditProvider();

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parseResult = AIEditRequestSchema.safeParse(json);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid AI edit request schema",
          details: parseResult.error.issues,
        },
        { status: 400 }
      );
    }

    const editRequest = parseResult.data;
    const proposal = await provider.generateEdit(editRequest);

    const proposalValidation = AIEditProposalSchema.safeParse(proposal);
    if (!proposalValidation.success) {
      return NextResponse.json(
        {
          error: "Provider generated invalid proposal schema",
          details: proposalValidation.error.issues,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      proposal: proposalValidation.data,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to process AI edit request",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

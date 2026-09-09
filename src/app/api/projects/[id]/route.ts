import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/server-session";
import { projectsService } from "@/lib/projects/service";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const project = projectsService.getProject(user.id, id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json({ project });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const { data, expectedRevision } = body;

    if (!data || !data.document) {
      return NextResponse.json({ error: "Invalid project data payload" }, { status: 400 });
    }

    const updated = projectsService.updateProject(
      user.id,
      id,
      data,
      typeof expectedRevision === "number" ? expectedRevision : undefined
    );

    return NextResponse.json({ project: updated });
  } catch (error: unknown) {
    const status = (error as { status?: number })?.status || 400;
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update project",
        isConflict: status === 409,
      },
      { status }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    let metadata;

    if (typeof body.name === "string") {
      metadata = projectsService.renameProject(user.id, id, body.name);
    } else if (typeof body.isArchived === "boolean") {
      metadata = projectsService.setArchiveStatus(user.id, id, body.isArchived);
    } else {
      return NextResponse.json({ error: "Invalid patch action" }, { status: 400 });
    }

    return NextResponse.json({ metadata });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to patch project" },
      { status: 400 }
    );
  }
}

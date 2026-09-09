import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/server-session";
import { projectsService } from "@/lib/projects/service";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const includeArchived = request.nextUrl.searchParams.get("includeArchived") === "true";
  const projects = projectsService.listProjects(user.id, includeArchived);
  return NextResponse.json({ projects });
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, initialData } = body;

    const project = projectsService.createProject(user.id, name || "Untitled Project", initialData);
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create project" },
      { status: 400 }
    );
  }
}

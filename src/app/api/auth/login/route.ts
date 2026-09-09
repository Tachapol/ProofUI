import { NextRequest, NextResponse } from "next/server";
import { authService, SESSION_COOKIE_NAME } from "@/lib/auth/service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, isDemo, role } = body;

    let result;
    if (isDemo) {
      result = await authService.getOrCreateDemoUser(role || "designer");
    } else {
      if (!email) {
        return NextResponse.json({ error: "Email is required" }, { status: 400 });
      }
      result = await authService.login({ email, password });
    }

    const response = NextResponse.json({ user: result.user });
    response.cookies.set(SESSION_COOKIE_NAME, result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 14 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Authentication failed" },
      { status: 401 }
    );
  }
}

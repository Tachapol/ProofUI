import { NextRequest, NextResponse } from "next/server";
import { authService, SESSION_COOKIE_NAME } from "@/lib/auth/service";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    authService.deleteSession(token);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    expires: new Date(0),
    path: "/",
  });

  return response;
}

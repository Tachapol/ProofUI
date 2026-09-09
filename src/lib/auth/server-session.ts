import { NextRequest } from "next/server";
import { authService, SESSION_COOKIE_NAME, UserRecord } from "./service";

export async function getAuthenticatedUser(request: NextRequest): Promise<UserRecord | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const result = authService.validateSession(token);
  return result ? result.user : null;
}

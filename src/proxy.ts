import { NextResponse, type NextRequest } from "next/server";
import { buildAbsoluteUrl } from "@/lib/http/request-origin";
import {
  createSessionToken,
  getSessionCookie,
  shouldRefreshSessionToken,
  shouldRejectSessionForAbsoluteAge,
  verifySessionToken,
} from "@/lib/auth/session-token";

const ADMIN_LOGIN_PATH = "/admin/prihlaseni";
const ADMIN_INVITE_PATH_PREFIX = "/admin/pozvanka";
const SESSION_COOKIE = getSessionCookie().name;

async function resolveSessionClaims(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === ADMIN_LOGIN_PATH) {
    return NextResponse.next();
  }

  if (pathname.startsWith(ADMIN_INVITE_PATH_PREFIX)) {
    return NextResponse.next();
  }

  const sessionClaims = await resolveSessionClaims(request);

  if (!sessionClaims) {
    const loginPath = `${ADMIN_LOGIN_PATH}?next=${encodeURIComponent(pathname)}`;
    const response = NextResponse.redirect(buildAbsoluteUrl(request, loginPath));
    if (request.cookies.has(SESSION_COOKIE)) {
      response.cookies.delete(SESSION_COOKIE);
    }
    return response;
  }

  const nowEpochSeconds = Math.floor(Date.now() / 1000);
  if (shouldRejectSessionForAbsoluteAge(sessionClaims, nowEpochSeconds)) {
    const loginPath = `${ADMIN_LOGIN_PATH}?next=${encodeURIComponent(pathname)}`;
    const response = NextResponse.redirect(buildAbsoluteUrl(request, loginPath));
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  const response = NextResponse.next();

  if (!shouldRefreshSessionToken(sessionClaims, nowEpochSeconds)) {
    return response;
  }

  if (
    typeof sessionClaims.sub !== "string" ||
    !sessionClaims.sub ||
    typeof sessionClaims.email !== "string" ||
    typeof sessionClaims.name !== "string" ||
    typeof sessionClaims.role !== "string"
  ) {
    const loginPath = `${ADMIN_LOGIN_PATH}?next=${encodeURIComponent(pathname)}`;
    const redirectResponse = NextResponse.redirect(buildAbsoluteUrl(request, loginPath));
    redirectResponse.cookies.delete(SESSION_COOKIE);
    return redirectResponse;
  }

  const refreshedToken = await createSessionToken(
    {
      sub: sessionClaims.sub,
      email: sessionClaims.email,
      name: sessionClaims.name,
      role: sessionClaims.role,
    },
    {
      nowEpochSeconds,
      sessionStartedAt: sessionClaims.sessionStartedAt ?? sessionClaims.iat ?? nowEpochSeconds,
    },
  );

  const sessionCookie = getSessionCookie();
  response.cookies.set(sessionCookie.name, refreshedToken, sessionCookie.options);

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
